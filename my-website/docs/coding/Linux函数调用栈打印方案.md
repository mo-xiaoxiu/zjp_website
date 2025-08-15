# Linux C 函数调用栈获取三种方案总结

本文总结了三种在 Linux 上用 C 获取并打印调用栈的方案：`execinfo`（backtrace）、`addr2line` 源码行解析、`libunwind` 展开。包括原理、调用流程、编译要点与最小示例代码。结合本项目文件与开关说明 `src/stacktrace.c`、`examples/examples.c`、`Makefile`。

---

## 目录
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [三种方案](#三种方案)
  - [1) execinfo：backtrace/backtrace_symbols（基础版）](#1-execinfobacktracebacktrace_symbols基础版)
  - [2) addr2line：地址到“函数-文件行”的解析（增强版）](#2-addr2line地址到函数-文件行的解析增强版)
  - [3) libunwind：更可靠的栈展开（专业版）](#3-libunwind更可靠的栈展开专业版)
- [信号崩溃打印](#信号崩溃打印)
- [如何选择](#如何选择)
- [常见问题](#常见问题)



---

## 三种方案

### 1) execinfo：backtrace/backtrace_symbols（基础版）

- **原理**
  - `execinfo.h` 的 `backtrace()` 采集返回地址数组，`backtrace_symbols()` 将地址转为符号字符串。
  - 简单易用、零额外依赖；但在高优化或省略帧指针时不够稳健，且不直接给“文件:行”。

- **调用流程**
  1. `backtrace(void **buffer, int size)` 抓取返回地址。
  2. `backtrace_symbols(void *const *buffer, int size)` 获取符号字符串。
  3. 打印并 `free(symbols)`。

- **编译要点**
  - 建议：`-g -O0 -fno-omit-frame-pointer -rdynamic`

- **最小示例**
  ```c
  #include <execinfo.h>
  #include <stdio.h>
  #include <stdlib.h>
  
  #define N 64
  
  void print_bt(void) {
      void *buf[N];
      int n = backtrace(buf, N);
      if (n <= 0) return;
      char **syms = backtrace_symbols(buf, n);
      if (!syms) return;
      for (int i = 0; i < n; ++i) {
          fprintf(stderr, "[%02d] %s\n", i, syms[i]);
      }
      free(syms);
  }
  ```

---

### 2) addr2line：地址到“函数 + 文件:行”的解析（增强版）

- **原理**
  - ELF 中的 DWARF 调试信息（由 `-g` 生成）记录“地址 <-> 文件:行”。
  - `addr2line -e <elf> 0x<offset>` 将地址转为“函数 + 文件:行”。
  - 由于 PIE/共享库 + ASLR，运行时绝对地址需换算为“相对模块基址的偏移”。
    - `dladdr(addr, &info)` 得到模块路径 `info.dli_fname` 与基址 `info.dli_fbase`。
    - `off = (uintptr_t)addr - (uintptr_t)info.dli_fbase`。

- **调用流程**
  1. 先通过 `backtrace()` 或 `libunwind` 得到每帧 IP。
  2. `dladdr()` 查模块路径与基址。
  3. 计算偏移并 `addr2line -e <obj> 0x<off>`。

- **编译要点**
  - 必须：`-g`
  - 建议：`-rdynamic`
  - 链接：`-ldl`
  
- **最小示例（单帧）**
  ```c
  #define _GNU_SOURCE
  #include <dlfcn.h>
  #include <stdint.h>
  #include <stdio.h>
  #include <stdlib.h>
  
  static void addr2line_one(void *addr) {
      Dl_info info; const char *path = NULL; uintptr_t base = 0;
      if (dladdr(addr, &info) && info.dli_fname && info.dli_fbase) {
          path = info.dli_fname; base = (uintptr_t)info.dli_fbase;
      } else {
          path = "/proc/self/exe"; base = 0;
      }
      uintptr_t off = (uintptr_t)addr - base;
      char cmd[1024];
      snprintf(cmd, sizeof(cmd), "addr2line -e '%s' -C -f -p 0x%lx 2>/dev/null",
               path, (unsigned long)off);
      FILE *fp = popen(cmd, "r"); if (!fp) return;
      char line[1024]; if (fgets(line, sizeof(line), fp)) fputs(line, stderr);
      pclose(fp);
  }
  ```

---

### 3) libunwind：更可靠的栈展开（专业版）

- **原理**
  - 使用 CFI（`.eh_frame` 等）与寄存器上下文逐帧展开；相对 `backtrace()` 更稳健，适合优化构建或省略帧指针时。
  - 得到 IP/函数名/偏移后，可叠加 `addr2line` 打印源码行。

- **调用流程**
  1. `unw_getcontext(&ctx)` 获取当前上下文。
  2. `unw_init_local(&cursor, &ctx)` 初始化游标。
  3. 循环 `unw_step(&cursor)` 上溯每一帧。
  4. 每帧用 `unw_get_reg(...UNW_REG_IP...)` 获取 IP，`unw_get_proc_name()` 获取函数名。
  5. 如需源码行，配合 `addr2line`。

- **编译要点**
  - 依赖：安装 `libunwind`（Debian/Ubuntu：`sudo apt-get install -y libunwind-dev`）
  - 链接：`-lunwind -lunwind-x86_64`（不同架构名称可能不同）
  
- **最小示例（核心循环）**
  ```c
  #include <libunwind.h>
  #include <stdio.h>
  
  void unwind_demo(void) {
      unw_cursor_t cur; unw_context_t ctx;
      if (unw_getcontext(&ctx) != 0) return;
      if (unw_init_local(&cur, &ctx) != 0) return;
      for (int i = 0; i < 64 && unw_step(&cur) > 0; ++i) {
          unw_word_t ip = 0, off = 0; char name[256];
          if (unw_get_reg(&cur, UNW_REG_IP, &ip) != 0) break;
          if (unw_get_proc_name(&cur, name, sizeof(name), &off) == 0) {
              fprintf(stderr, "[%02d] %s+0x%lx (%p)\n",
                      i, name, (unsigned long)off, (void*)(uintptr_t)ip);
          } else {
              fprintf(stderr, "[%02d] %p\n", i, (void*)(uintptr_t)ip);
          }
      }
  }
  ```

---

## 信号崩溃打印

- **原理**：捕捉 `SIGSEGV`、`SIGABRT`，在信号处理器里打印调用栈。
- **注意**：信号处理器中应尽量使用异步信号安全的 API；为简洁可以使用 `fprintf`，适合开发调试。

---

## 如何选择
- **快速集成/开发调试**：`execinfo` + `addr2line`（推荐编译：`-g -O0 -fno-omit-frame-pointer -rdynamic`）。
- **优化构建/无帧指针**：启用 `libunwind` 展开，必要时叠加 `addr2line`。
- **最少依赖**：仅 `execinfo`，但信息粗糙（无具体行号）。

---

## 常见问题
- 输出 `??:0`：可能没用 `-g`、未做 PIE/DSO 偏移换算、或库本身无调试信息。
- 高优化或省略帧指针：栈可能不完整；开发期建议 `-O0 -fno-omit-frame-pointer`。
- musl/Alpine：`execinfo.h` 可能需要 `libexecinfo` 且链接 `-lexecinfo`。

