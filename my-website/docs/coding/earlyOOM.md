# earlyOOM

## 简介

earlyoom 是一个用户态 OOM 监控守护进程。核心逻辑：

* 定期读取系统内存与交换分区信息`/proc/meminfo`。
* 当“可用内存”和“可用交换分区”同时低于阈值时，选择一个“最应当被杀”的进程并发送信号（先 SIGTERM，必要时升级到 SIGKILL）。
* 进程选择依据：默认最大 `oom_score`，可选按最大 RSS（`--sort-by-rss`）。
* 强化逻辑：进程组杀、偏好/避免/忽略正则、D-Bus/外部脚本通知、`process_mrelease` 尽快释放内存、适配 `proc hidepid` 等。

主要模块与职责：

* main.c：参数解析、启动自检、锁内存、主轮询循环`poll_loop()`
* meminfo.c：解析`/proc/meminfo`，提供百分比与衍生指标，活性检查`is_alive()`
* kill.c：选择受害者`find_largest_process()`，对比逻辑`is_larger()`，发送信号与等待退出`kill_wait()`，`process_mrelease`
* proc_pid.c：解析`/proc/[pid]/stat`（进程状态、ppid、线程数、rss 页数）
* msg.c：`日志/颜色/（可选）`syslog，参数解析辅助
* `globals.*`：全局开关与 `/proc` 路径



## 框架图

```mermaid
flowchart LR
    subgraph EarlyOOM Daemon
        MAIN["main.c<br/>启动/参数/主循环 poll_loop()"]
        KILL["kill.c<br/>选择/发信号/等待/释放"]
        MEM["meminfo.c<br/>/proc/meminfo 解析/<br/>百分比/进程属性"]
        STAT["proc_pid.c<br/>/proc/[pid]/stat 解析"]
        MSG["msg.c<br/>日志/着色/syslog/DBus/外部脚本"]
        GLOB["globals.*<br/>enable_debug/procdir_path"]
    end

    OS[(Linux Kernel)]
    PROC["‘/proc’ 文件系统"]
    DBUS[(D-Bus)]
    SYSLOG[(syslog)]
    EXT[[外部通知脚本]]

    MAIN --> MEM
    MAIN --> KILL
    MAIN --> MSG
    MAIN --> GLOB

    KILL --> MEM
    KILL --> STAT
    KILL --> MSG

    MEM --- PROC
    STAT --- PROC

    KILL -.-> OS
    KILL -. pidfd_open/process_mrelease .-> OS
    MSG -.-> SYSLOG
    MSG -.-> DBUS
    MSG -.-> EXT
```

## 总体时序图

```mermaid
sequenceDiagram
    participant Main as main() / poll_loop() [main.c]
    participant MI as parse_meminfo() [meminfo.c]
    participant Sel as find_largest_process() [kill.c]
    participant Cmp as is_larger() [kill.c]
    participant KP as kill_process() [kill.c]
    participant KW as kill_wait() [kill.c]
    participant KR as kill_release() [kill.c]
    participant STAT as parse_proc_pid_stat() [proc_pid.c]
    participant MSG as msg/log/notify [msg.c]
    participant PROC as /proc FS
    participant K as Kernel

    Main->>MI: 冷启动读取 /proc/meminfo
    Main->>MSG: 解析参数/阈值/正则，打印配置
    Main->>K: mlockall()（失败则降级参数）
    loop 主循环
        Main->>MI: parse_meminfo()
        MI->>PROC: 读取 /proc/meminfo
        MI-->>Main: meminfo_t（含 MemAvailable%/SwapFree%）

        alt 达到 TERM/KILL 阈值
     
            Main->>Sel: 选择受害者
            Sel->>PROC: 遍历 /proc/[pid] 目录
            loop 对每个候选进程
                Sel->>Cmp: is_larger(victim, cur)
                Cmp->>STAT: parse_proc_pid_stat(pid)
                STAT->>PROC: 读 /proc/[pid]/stat
                Cmp->>MI: get_oom_score/adj、get_comm/uid（经 meminfo.c）
                Cmp-->>Sel: 更大/否（考虑 regex/排序模式）
            end
            Sel-->>Main: 返回 victim（procinfo_t）

            Main->>MI: 再次 parse_meminfo() 双检
            alt 情况已恢复
                Main->>MSG: warn 恢复，不杀
            else 仍低
                Main->>KP: kill_process(sig, victim)
                KP->>KW: kill_wait(pid, sig, -g?)
                alt 支持 pidfd/process_mrelease 且 sig!=0
                    KW->>K: pidfd_open(pid)
                end
                KW->>KR: kill_release(pid/pidfd, sig)
                KR->>K: kill(2) 发送信号
                opt 可用时
                    KR->>K: process_mrelease(pidfd)
                end
                loop ≤ ~10s 轮询
                    KW->>MI: parse_meminfo()（条件/调试）
                    KW->>PROC: is_alive(pid)?（通过 /proc）
                    alt 需要升级
                        KW->>KR: 再次 kill_release(SIGKILL)
                    end
                end
                KW-->>KP: 成功/超时
                KP->>MSG: 通知（D-Bus/外部脚本/日志）
            end
        else 未达阈值
            Main->>MSG: 周期性 info 报告（可选）
        end
        Main->>Main: 计算自适应 sleep 时间
        Main->>K: nanosleep(ms)
    end
```



## 处理函数流程图

### main启动与参数解析

```mermaid
flowchart TD
    A["启动 main()"] --> B["打印版本/切换目录到 /proc<br/>chdir(procdir_path)"]
    B --> C["parse_meminfo()"]
    C --> D["循环 getopt_long 解析参数"]
    D -->|'-m','-s','-M','-S'| E["parse_term_kill_tuple()<br/>校验/上下限/term>=kill"]
    D -->|'-n'| F["args.notify=true"]
    D -->|'-g'| G["args.kill_process_group=true"]
    D -->|'-N PATH'| H["args.notify_ext=PATH"]
    D -->|'-d'| I["enable_debug=1"]
    D -->|'-r SEC'| J["args.report_interval_ms=SEC*1000"]
    D -->|'-p'| K["set_my_priority=1"]
    D -->|"--ignore-root-user"| L["args.ignore_root_user=true"]
    D -->|"--sort-by-rss"| M["args.sort_by_rss=true"]
    D -->|"--prefer/--avoid/--ignore REGEX"| N["regcomp() 到 *_regex"]
    D --> O["参数合并：-M与-m，-S与-s<br/>取更小百分比"]
    O --> P["打印阈值与总量"]
    P --> Q["startup_selftests(args)"]
    Q --> R["mlockall(MCL_CURRENT|MCL_FUTURE|MCL_ONFAULT)<br/>失败→去掉ONFAULT再试"]
    R --> S["poll_loop(args)"]
    S -->|"loop"| S
```

### poll_loop主循环

```mermaid
flowchart TD
    A["循环开始"] --> B["parse_meminfo()"]
    B --> C["lowmem_sig(args, m)"]
    C -->|返回0| D{"report_interval_ms 到时?"}
    D -->|是| E["print_mem_stats(info, m)"]
    D --> F["计算 sleep_time_ms(args, m)"]
    F --> G["nanosleep(ms)"]
    G --> A
    C -->|SIGTERM/SIGKILL| H["print_mem_stats(warn, m)+warn阈值命中"]
    H --> I["选择受害者: find_largest_process(args)"]
    I --> J["再次 parse_meminfo() 双检"]
    J -->|已恢复| K["warn: 情况恢复, 不杀"]
    K --> F
    J -->|仍低| L["kill_process(args, sig, victim)"]
    L --> F
```

### 选择受害者进程

```mermaid
flowchart TD
    A["opendir(/proc)"] --> B["debug_print_procinfo_header()"]
    B --> C["初始化 victim=empty_procinfo"]
    C --> D["readdir 循环"]
    D -->|"非数字目录"| D
    D --> E["cur.pid = atoi(d_name)"]
    E --> F["larger = is_larger(args, &victim, &cur)"]
    F --> G["debug_print_procinfo(&cur)"]
    G -->|larger| H["标记 new victim; victim=cur"]
    G -->|否则| D
    H --> D
    D -->|结束| I["closedir"]
    I --> J["若 victim.pid==getpid() <br/>→ warn + 清零"]
    J --> K["fill_informative_fields(victim)<br/>补齐 name/cmdline/uid"]
    K --> L["返回 victim"]
```

### 进程比较决策

```mermaid
flowchart LR
    S["开始 is_larger()"] --> A{"pid<=2?"}
    A -->|"是"| X1["返回 false"]
    A -->|"否"| B{"ignore_root_user?"}
    B -->|"是"| C["get_uid(pid)"]
    C -->|"失败"| X2["false"]
    C -->|"uid==0"| X3["false"]
    B -->|"否"| D["parse_proc_pid_stat(&cur->stat)"]
    D -->|"失败"| X4["false"]
    D -->|"成功"| E["VmRSSkiB=stat.rs*<br/>sysconf(PAGESIZE)/1024"]
    E --> F{"ppid==2?"}
    F -->|"是"| X5["false"]
    F -->|"否"| G["get_oom_score(pid)"]
    G -->|"失败"| X6[false]
    G --> H{"有 prefer/avoid/ignore?"}
    H -->|"有"| I["get_comm(pid, name)"]
    I -->|"失败"| X7[false]
    I --> J["根据 regex: <br/>prefer→加分/加权<br/>avoid→减分/减权<br/>ignore→false"]
    H --> K{"排序模式"}
    K -->|"--sort-by-rss"| R["按 VmRSSkiB 为主<br/>rss=0 <br/>特殊：用 oom_score 兜底，<br/>平手看另一指标"]
    K -->|"默认"| Q["按 oom_score 为主，平手看 VmRSSkiB"]
    R --> L["候选更大? 是/否"]
    Q --> L
    L --> M["get_oom_score_adj(pid,&adj)"]
    M -->|失败| X8[false]
    M -->|adj==-1000| X9[false]
    M --> Y["返回比较结果"]
```

### 杀进程处理

```mermaid
sequenceDiagram
    participant Caller as poll_loop()
    participant KP as kill_process()
    participant KW as kill_wait()
    participant KR as kill_release()
    participant K as kernel

    Caller->>KP: kill_process(args, sig, victim)
    KP->>KP: 打印 kill 日志/选择信号名
    KP->>KW: kill_wait(args, pid, sig)

    alt dryrun 且 sig!=0
        KW-->>KP: 立即返回(不发送)
    else
        KW->>KW: 若 -g：getpgid→pid=-pgid
        alt 内核支持 process_mrelease 且 非 -g 且 sig!=0
            KW->>KW: pidfd_open(pid)
        end
        KW->>KR: kill_release(pid, pidfd, sig)
        KR->>K: kill(pid, sig)
        opt 有 pidfd
            KR->>K: syscall process_mrelease(pidfd, 0)
            K-->>KR: 成功/失败日志
        end

        opt sig==0（自检）
            KW-->>KP: 不等待退出
        end

        loop 最多 ~10 秒（每100ms）
            KW->>KW: 计算已过时间
            alt sig!=SIGKILL
                KW->>meminfo.c: parse_meminfo()
                alt 已达 KILL 阈值
                    KW->>KR: 再次 kill_release(SIGKILL)
                end
            else
                opt enable_debug
                    KW->>meminfo.c: parse_meminfo() + info日志
                end
            end
            KW->>meminfo.c: is_alive(pid)
            alt 已退出
                KW-->>KP: 返回成功（打印耗时）
            end
            KW->>KW: nanosleep(100ms)
        end
        KW-->>KP: 超时/失败→返回错误
    end

    KP->>KP: 若 sig!=0 → 发送通知（D-Bus/外部脚本，dryrun有速率限制）
    KP-->>Caller: 完成（若失败 → warn + 可能 sleep 节流）
```

## 读取信息函数流程图

### 读取系统内存信息

```mermaid
flowchart TD
    A["静态打开 /proc/meminfo<br/>首次 fopen 并缓存 fd] --> B[rewind(fd)"]
    B --> C["fread 到 buf"]
    C -->|"失败/空"| X["fatal()"]
    C --> D["解析关键字段：<br/>MemTotal<br/>SwapTotal<br/>AnonPages<br/>SwapFree"]
    D --> E["MemAvailable = get_entry(MemAvailable:)"]
    E -->|缺失| F["available_guesstimate()<br/>= MemFree + Cached <br>+ Buffers - Shmem<br/>告警一次"]
    E -->|存在| G[使用内核值]
    F --> H["UserMemTotalKiB = MemAvailableKiB <br/>+ AnonPagesKiB"]
    G --> H
    H --> I["计算百分比<br/>MemAvailable%=MemAvailable<br>/UserMemTotal<br/>SwapFree%=SwapFree<br>/SwapTotal"]
    I --> J[返回 meminfo_t]
```

### 读取进程状态信息

```mermaid
flowchart TD
    A["构造路径/proc/pid/stat"] --> B["fopen读取(≤511字节)"]
    B -->|"失败"| X["返回 false（进程可能已消失)"]
    B --> C["buf[len]=0 终止"]
    C --> D["parse_proc_pid_stat_buf(out, buf)"]

    subgraph parse_proc_pid_stat_buf
        E["定位最后一个 ')' comm 结束"] -->|"无"| X1["false"]
        E --> F["')' 后必须有字符"]
        F --> G["state_field解析进程状态"]
        G --> H["sscanf 从 state 起解析：<br/>state, ppid, num_threads,<br/> rss<br/>其余用 %* 跳过"]
        H -->|"ret!=4(解析字段数量不为4)"| X2[false]
        H --> Y[true]
    end
```

## 其他功能函数流程图

### 自适应睡眠

```mermaid
flowchart LR
    A["headroom_kib=<br/>(MemAvail%-mem_term%) *<br/> UserMemTotalKiB/100<br/>(SwapFree%-swap_term%) *<br/>SwapTotalKiB/100<br/>负值夹为0"]
    A --> B["估计ms=mem_headroom/<br/>6000 + swap_headroom/800"]
    B --> C[夹在 100..1000ms]
    C --> D[返回 sleep_ms]
```

### 低内存信号判断

```mermaid
flowchart LR
    A["MemAvail% ≤ mem_kill%且<br/>SwapFree% ≤<br/> swap_kill%] -->|是| B[SIGKILLL"]
    A -->|否| C["MemAvail% ≤ mem_term% 且 <br/>SwapFree% ≤ swap_term%"]
    C -->|是| D["SIGTERM"]
    C -->|否| E[0]
```

