# C++虚函数表在哪个位置呢？

一般C++的继承和虚函数的配合使用，能给我们提供多态的行为，我们今天来探究一下这背后，虚函数指针的调用和虚函数表在内存中的位置情况。

我们写一个最基本的C++程序来验证：

```cpp
#include <iostream>

class Base{
public:
    Base() = default;
    virtual ~Base() {
        std::cout << "Base destructor" << std::endl;
    }

    virtual void func() {
        std::cout << "Base func call" << std::endl;
    }
private:
};

class Derive: public Base {
public:
    Derive() = default;
    ~Derive() {
        std::cout << "Derive destructor" << std::endl;
    }

    void func() override {
        std::cout << "Derive func call" << std::endl;
    } 
private:
};

int main() {
    Base *bp = new Derive();
    bp->func();
    delete bp;

    return 0;
}
```

* `Derive`继承`Base`并重写虚函数`func`
* 在main中我们new一个子类对象指向父类指针
* 父类指针调用`func`

最后输出结果如下：

```shell
Derive func call
Derive destructor
Base destructor
```

## 理论

这是我们大家熟知的继承和虚函数重写。我们知道，在这个例子中，
* `bp`指针指向堆上的对象，且对应一个虚函数指针；
* 这个虚函数指针会指向虚函数表，虚函数表中存放的是`Derive`重写的`func`地址；
* 在我们使用`bp->func()`时，会传入一个`this`指针（父类指针）给到`func`，并根据RTTI信息转成子类类型`Derive`，然后根据虚函数表的`offeset_to_top`找到`Derive`重写的`func`地址。
* 我们也知道，虚函数表是在编译期间就完成构建的

那么虚函数表在编译之后，是存放在ELF文件/可执行文件、进程空间中的哪个位置呢？

## 虚函数表在ELF中的位置

我们使用以下命令来验证：

```shell
nm -C test | c++filt | grep vtable
```

输出如下：

```shell
0000000000003d30 V vtable for Base
0000000000003d08 V vtable for Derive
```

这两个地址分别是 `Base` 和 `Derive`的虚函数表（vtable）在可执行文件中的虚拟地址

```shell
objdump -S test|c++filt 
```

关注输出如下：

```shell
[24] .data.rel.ro      PROGBITS         0000000000003d08  00002d08
     0000000000000078  0000000000000000  WA       0     0     8
```

`.data.rel.ro` 节的起始地址是 `0x3d08`，大小为 `0x78` 字节

所以`Base`和`Derive`虚函数表地址都在`.data.rel.ro`中

> 那为什么在这个例子中，虚函数表会在`.data.rel.ro`中呢？

原因如下：

* vtable 是一个全局静态数组，里面存放的是虚函数的地址（指针）。
* 这些指针在程序加载时可能需要**重定位**（relocation），因为虚函数实现可能在不同的共享库或位置。
* vtable 在程序运行期间**不需要修改**，所以它是只读的（read-only）。

## 虚函数指针在ELF中的调用

接下来我们看下在ELF中，对应的虚函数是如何调用到的。我们可以使用：

```shell
objdump -S test | c++filt
```

我们定位到输出里边`main`的这一部分：

```shell
int main() {
    ....
    Base *bp = new Derive();
    11f6:       bf 08 00 00 00          mov    $0x8,%edi
    11fb:       e8 c0 fe ff ff          call   10c0 <operator new(unsigned long)@plt>
    1200:       48 89 c3                mov    %rax,%rbx
    1203:       48 c7 03 00 00 00 00    movq   $0x0,(%rbx)
    120a:       48 89 df                mov    %rbx,%rdi
    120d:       e8 4c 02 00 00          call   145e <Derive::Derive()>
    1212:       48 89 5d e8             mov    %rbx,-0x18(%rbp)
    bp->func();
    1216:       48 8b 45 e8             mov    -0x18(%rbp),%rax
    121a:       48 8b 00                mov    (%rax),%rax
    121d:       48 83 c0 10             add    $0x10,%rax
    1221:       48 8b 10                mov    (%rax),%rdx
    1224:       48 8b 45 e8             mov    -0x18(%rbp),%rax
    1228:       48 89 c7                mov    %rax,%rdi
    122b:       ff d2                   call   *%rdx
    delete bp;
    ....
```

下面详细解释这段汇编代码，分为两部分：对象创建和虚函数调用。

1. `Base *bp = new Derive();` 对象创建部分

```asm
11f6:       bf 08 00 00 00          mov    $0x8,%edi
```

* 将 8（对象大小，Derive类只有虚表指针，没有成员变量）放入 `%edi`，作为 `operator new` 的参数。

```asm
11fb:       e8 c0 fe ff ff          call   10c0 <operator new(unsigned long)@plt>
```

* 调用 `operator new`，分配 8 字节内存，返回地址在 `%rax`。

```asm
1200:       48 89 c3                mov    %rax,%rbx
```

* 把分配到的内存地址保存到 `%rbx`。

```asm
1203:       48 c7 03 00 00 00 00    movq   $0x0,(%rbx)
```

* 初始化对象首地址内容为 0（先清空 vptr）。

```asm
120a:       48 89 df                mov    %rbx,%rdi
```

* 把对象地址作为参数传给 Derive 构造函数（this 指针）。

```asm
120d:       e8 4c 02 00 00          call   145e <Derive::Derive()>
```

* 调用 Derive 的构造函数，构造函数会设置 vptr。

```asm
1212:       48 89 5d e8             mov    %rbx,-0x18(%rbp)
```

* 把对象地址保存到局部变量（bp）。

2. `bp->func();` 虚函数调用部分

```asm
1216:       48 8b 45 e8             mov    -0x18(%rbp),%rax
```

* 取出 bp 指针（对象地址）到 `%rax`。

```asm
121a:       48 8b 00                mov    (%rax),%rax
```

* 取出对象首地址内容（vptr），即虚函数表地址。

```asm
121d:       48 83 c0 10             add    $0x10,%rax
```

* 虚函数表加偏移 0x10，找到 func 的函数指针（第2个虚函数，通常第一个是析构函数）。

```asm
1221:       48 8b 10                mov    (%rax),%rdx
```

* 取出虚函数表中 func 的地址到 `%rdx`。

```asm
1224:       48 8b 45 e8             mov    -0x18(%rbp),%rax
```

* 再次取出 bp 指针到 `%rax`。

```asm
1228:       48 89 c7                mov    %rax,%rdi
```

* 把对象地址作为 this 指针传给 func。

```asm
122b:       ff d2                   call   *%rdx
```

* 间接调用 func（实际调用 Derive::func，因为 bp 指向 Derive）。

从以上过程我们可以看到，虚函数指针是在对象的构造函数里边完成初始化的，且我们在调用`func`的时候是需要bp指针（也就是this）来传参的。我们看下`Derive`的构造函数里边是如何设置虚函数指针的：

```shell
000000000000145e <Derive::Derive()>:
    Derive() = default;
    145e:       f3 0f 1e fa             endbr64 
    1462:       55                      push   %rbp
    1463:       48 89 e5                mov    %rsp,%rbp
    1466:       48 83 ec 10             sub    $0x10,%rsp
    146a:       48 89 7d f8             mov    %rdi,-0x8(%rbp)
    146e:       48 8b 45 f8             mov    -0x8(%rbp),%rax
    1472:       48 89 c7                mov    %rax,%rdi
    1475:       e8 c6 ff ff ff          call   1440 <Base::Base()>
    147a:       48 8d 15 97 28 00 00    lea    0x2897(%rip),%rdx        # 3d18 <vtable for Derive+0x10>
    1481:       48 8b 45 f8             mov    -0x8(%rbp),%rax
    1485:       48 89 10                mov    %rdx,(%rax)
    1488:       90                      nop
    1489:       c9                      leave  
    148a:       c3                      ret   
```

以上这段代码做了几件事情：

* 设置函数栈帧，保存旧的 `%rbp`，分配局部变量空间
* 将传入的 `this` 指针（对象地址）保存到栈上 `-0x8(%rbp)`
* 取出 `this` 指针，传给`Base`构造函数，完成父类部分初始化
* 计算`Derive`虚函数表的地址（`vtable for Derive+0x10`），存入`%rdx`
* 将 `%rdx`（vtable 地址）写入对象首地址（即设置 vptr）
* 清理栈帧，返回

这里对于`Derive`的虚函数表地址也做了注释，计算方式如下：

* 当前指令地址：`0x147a`
* 偏移量：`0x2897`
* 目标地址：`0x147a + 0x2897 = 0x3d11`（实际 objdump 会自动加上指令长度，最终结果是 `0x3d18`）

**这和我们前面验证虚函数表的地址是一致的**

## 虚函数表在进程空间中的位置

上面我们搞清楚了虚函数指针在ELF中的调用和虚函数表在ELF中的位置，现在我们来看下虚函数表在进程空间中的位置。我们使用gdb来调试程序：

```shell
gdb ./test
(gdb) break 31
(gdb) run
....
(gdb) print bp
(gdb) x/gx bp
```

`x/gx` 是 gdb 的**内存查看指令**，含义如下：

* `x`：examine，查看内存内容。
* `g`：giant word，表示一次查看 8 字节（64 位）。
* `x`：以十六进制格式显示

我在`b->func()`处打了断点，以上指令对应的输出如下：

```shell
(gdb) p bp
$1 = (Base *) 0x55555556aeb0
(gdb) p &bp
$2 = (Base **) 0x7fffffffdf48
(gdb) x/gx bp
0x55555556aeb0: 0x0000555555557d30
(gdb) info symbol 0x0000555555557d30
vtable for Derive + 16 in section .data.rel.ro of /home/zjp-android/test/test
```

* bp在`0x55555556aeb0`
* 虚函数指针在`0x0000555555557d30`，指向了虚函数表

为了在进程虚拟地址空间中找到这两个地址对应的区域，我们可以在gdb中使用`info proc mappings`查看：

```shell
(gdb) info symbol 0x0000555555557d30
vtable for Derive + 16 in section .data.rel.ro of /home/zjp-android/test/test
(gdb) info proc mappings
process 126813
Mapped address spaces:

          Start Addr           End Addr       Size     Offset  Perms  objfile
      0x555555554000     0x555555555000     0x1000        0x0  r--p   /home/zjp-android/test/test
      0x555555555000     0x555555556000     0x1000     0x1000  r-xp   /home/zjp-android/test/test
      0x555555556000     0x555555557000     0x1000     0x2000  r--p   /home/zjp-android/test/test
      0x555555557000     0x555555558000     0x1000     0x2000  r--p   /home/zjp-android/test/test
      0x555555558000     0x555555559000     0x1000     0x3000  rw-p   /home/zjp-android/test/test
      0x555555559000     0x55555557a000    0x21000        0x0  rw-p   [heap]
      0x7ffff7800000     0x7ffff7828000    0x28000        0x0  r--p   /usr/lib/x86_64-linux-gnu/libc.so.6
      0x7ffff7828000     0x7ffff79bd000   0x195000    0x28000  r-xp   /usr/lib/x86_64-linux-gnu/libc.so.6
      0x7ffff79bd000     0x7ffff7a15000    0x58000   0x1bd000  r--p   /usr/lib/x86_64-linux---Type <RET> for more, q to quit, c to continue without paging--c
gnu/libc.so.6
      0x7ffff7a15000     0x7ffff7a16000     0x1000   0x215000  ---p   /usr/lib/x86_64-linux-gnu/libc.so.6
      0x7ffff7a16000     0x7ffff7a1a000     0x4000   0x215000  r--p   /usr/lib/x86_64-linux-gnu/libc.so.6
      0x7ffff7a1a000     0x7ffff7a1c000     0x2000   0x219000  rw-p   /usr/lib/x86_64-linux-gnu/libc.so.6
      0x7ffff7a1c000     0x7ffff7a29000     0xd000        0x0  rw-p   
      0x7ffff7c00000     0x7ffff7c9a000    0x9a000        0x0  r--p   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7c9a000     0x7ffff7dab000   0x111000    0x9a000  r-xp   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7dab000     0x7ffff7e1a000    0x6f000   0x1ab000  r--p   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7e1a000     0x7ffff7e1b000     0x1000   0x21a000  ---p   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7e1b000     0x7ffff7e26000     0xb000   0x21a000  r--p   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7e26000     0x7ffff7e29000     0x3000   0x225000  rw-p   /usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.30
      0x7ffff7e29000     0x7ffff7e2c000     0x3000        0x0  rw-p   
      0x7ffff7e9e000     0x7ffff7ea2000     0x4000        0x0  rw-p   
      0x7ffff7ea2000     0x7ffff7ea5000     0x3000        0x0  r--p   /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
      0x7ffff7ea5000     0x7ffff7ebc000    0x17000     0x3000  r-xp   /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
      0x7ffff7ebc000     0x7ffff7ec0000     0x4000    0x1a000  r--p   /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
      0x7ffff7ec0000     0x7ffff7ec1000     0x1000    0x1d000  r--p   /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
      0x7ffff7ec1000     0x7ffff7ec2000     0x1000    0x1e000  rw-p   /usr/lib/x86_64-linux-gnu/libgcc_s.so.1
      0x7ffff7ec2000     0x7ffff7ed0000     0xe000        0x0  r--p   /usr/lib/x86_64-linux-gnu/libm.so.6
      0x7ffff7ed0000     0x7ffff7f4c000    0x7c000     0xe000  r-xp   /usr/lib/x86_64-linux-gnu/libm.so.6
      0x7ffff7f4c000     0x7ffff7fa7000    0x5b000    0x8a000  r--p   /usr/lib/x86_64-linux-gnu/libm.so.6
      0x7ffff7fa7000     0x7ffff7fa8000     0x1000    0xe4000  r--p   /usr/lib/x86_64-linux-gnu/libm.so.6
      0x7ffff7fa8000     0x7ffff7fa9000     0x1000    0xe5000  rw-p   /usr/lib/x86_64-linux-gnu/libm.so.6
      0x7ffff7fbb000     0x7ffff7fbd000     0x2000        0x0  rw-p   
      0x7ffff7fbd000     0x7ffff7fc1000     0x4000        0x0  r--p   [vvar]
      0x7ffff7fc1000     0x7ffff7fc3000     0x2000        0x0  r-xp   [vdso]
      0x7ffff7fc3000     0x7ffff7fc5000     0x2000        0x0  r--p   /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2
      0x7ffff7fc5000     0x7ffff7fef000    0x2a000     0x2000  r-xp   /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2
      0x7ffff7fef000     0x7ffff7ffa000     0xb000    0x2c000  r--p   /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2
      0x7ffff7ffb000     0x7ffff7ffd000     0x2000    0x37000  r--p   /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2
      0x7ffff7ffd000     0x7ffff7fff000     0x2000    0x39000  rw-p   /usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2
      0x7ffffffde000     0x7ffffffff000    0x21000        0x0  rw-p   [stack]
  0xffffffffff600000 0xffffffffff601000     0x1000        0x0  --xp   [vsyscall]
(gdb) 
```

得出结果：

| 元素                  | 地址                         | 所属内存区域                                    | 权限 | 说明                                                         |
| :-------------------- | :--------------------------- | :---------------------------------------------- | :--- | :----------------------------------------------------------- |
| **`bp`指针本身**      | `0x7fffffffdf48`             | **[stack]** (栈)                                | rw-p | 局部变量 `bp`存储在栈上，但其**值**是堆地址，指向动态创建的 `Derive`对象。 |
| **`bp`指向的对象**    | `0x55555556aeb0`             | **[heap]** (堆)                                 | rw-p | 由 `new Derive()`在堆上分配的对象实例。                      |
| **虚函数表 (vtable)** | `0x0000555555557d30`         | 程序本身的 **`.data.rel.ro`** 段 (可执行文件内) | rw-p | `Derive`类的虚函数表，存储在程序的数据段中。                 |
| **vptr**              | `0x55555556aeb0`地址处的内容 | 对象内存布局的起始部分                          | N/A  | 指向虚函数表的指针，存储在对象实例的开头。                   |

* 虚函数表的地址
  * **地址**: `0x0000555555557d30`
  * **所在区域**: 可执行文件 **`/home/zjp-android/test/test`** 的 **`.data.rel.ro`** 段
  * 这个地址落在映射区域：`0x555555554000     0x555555555000     0x1000        0x0  r--p`(程序文本段, 只读) 和 `0x555555558000     0x555555559000     0x1000     0x3000  rw-p`(数据段, 读写) 之间。根据 `info symbol`的输出，它明确指出了其在 **`.data.rel.ro`** section。这是一个存储**只读重定位数据**的段

## 总结

1. **虚函数表 (vtable) 的生命周期与位置**

   * vtable 在**编译时**由编译器生成，是类的静态数据

   * 可通过 `nm`和 `objdump`命令找到的 `vtable for Derive`和 `vtable for Base`的地址证实了这一点。

   * 在本例中它存储在可执行文件的**重定位只读数据段（`.data.rel.ro`）** 中。

   * 程序运行时，vtable 会被加载到对应的内存映射区域（在GDB `info proc mappings`输出中，对应于可执行文件映射的具有读权限的段）。

2. **虚函数指针 (vptr) 的生命周期与位置**

   * vptr 是每个含有虚函数的对象实例的一部分。它在**运行时**对象构造时被初始化，指向其类对应的 vtable。

   * vptr 在对象内存布局中的位置通常位于**对象的起始处**。这可以通过在GDB中使用 `x/gx bp`命令得到验证，该命令显示对象地址 `0x55555556aeb0`处的值就是 vptr 的值 `0x0000555555557d30`。

   * vptr 本身所在的**内存区域取决于对象的分配方式**。

3. **多态调用的过程**

   多态调用的过程：

   * 通过对象的 vptr 找到 vtable。
   * 在 vtable 中通过固定的偏移量找到要调用的虚函数地址。
   * 传递 `this`指针（即对象地址）并调用函数。

## 思考

> 虚函数表除了在`.data.rel.ro`之外，还有可能存放在哪里？

交给你们了。