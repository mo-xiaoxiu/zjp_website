# Linux kernel lesson 

## 查看/设置硬件信息和配置

查看硬件信息收集指令：

* `lshw` 和`lspci`
* `lsusb`和`lsblk`
* `lscpu`和`lsdev`

*指令前需要加上`sudo`*

硬件控制和配置指令：

* `hdparm`：获取或设置硬盘参数
* `inb`和`outb`：访问PC硬件上的IO端口
* `setpci`：配置PCI设备

> 问题：如何查看Linux系统以下问题？
>
> 1. 系统上有没有PCI Ethernet设备？
>
>    ```shell
>    lspci | grep -i 'ethernet'
>    ```
>
> 2. 系统上有多少CPU？
>
>    ```shell
>    lscpu | grep '^CPU'
>    ```
>
> 3. 系统上有多少块设备？
>
>    ```shell
>    lsblk | wc -l
>    ```
>
>    



## 系统调用

* 可以通过`strace`追踪进程系统调用，使用`-p`选项追加进程号，可查看对应运行进程当前的系统调用情况

> 问题：
>
> 1. 使用 man 命令，确定 strace 的哪个选项将显示进程调用每个系统调用的次数的摘要和计数；使用该选项，截至命令date调用最多的系统调用是什么？
>
>    ```shell
>    strace -c date # 可以看到系统调用date的次数和计数
>    strace -c -S calls date # 可以按照calls列来进行从大到小的排序
>    ```
>
> 2. 你能用 strace 确定哪个系统调用用于更改目录吗？
>
>    由于cd并不是linux内置的指令，实际上是shell内置的指令，我们可以通过`whereis cd`发现没有具体路径：
>
>    ```shell
>    zjp@zjp-virtual-machine:~$ whereis cd
>    cd:
>    ```
>
>    我们可以编写一个简单的测试脚本，并使用`strace`的`-f`选项来追踪`bash`在执行cd的时候做了哪些操作：
>
>    ```shell
>    echo "cd /noexit" > cd_test.sh # cd到一个不存在的文件目录
>    
>    chmod +x cd_test.sh
>    
>    strace -f bash ./cd_test.sh
>    
>    strace -f bash ./cd_test.sh |& grep -i "noexit"
>    # 输出如下
>    read(255, "cd /noexit\n", 11)           = 11
>    newfstatat(AT_FDCWD, "/noexit", 0x7ffe70730b10, 0) = -1 ENOENT (没有那个文件或目录)
>    chdir("/noexit")                        = -1 ENOENT (没有那个文件或目录)
>    chdir("/noexit")                        = -1 ENOENT (没有那个文件或目录)
>    write(2, "./cd_test.sh: \347\254\254 1 \350\241\214\357\274\232 cd: /"..., 68./cd_test.sh: 第 1 行： cd: /noexit: 没有那个文件或目录
>    
>    ```
>
> 3. 编写一个单行 shell 脚本，其中内容为 date > /dev/null，然后使用 strace 的 -f 选项跟踪新进程，并使用 -o 将 trace 输出放入文件中，以确定 date 命令是否是打开 /dev/null 的进程
>
>    ```shell
>    # 编写脚本并赋予执行权限
>    echo "date > /dev/null" > test_date.sh && chmod +x test_date.sh
>    
>    strace -f -o output.out bash ./test_date.sh
>    
>    cat output.out |& grep -i "date"
>    # 输出如下
>    214001 execve("/usr/bin/bash", ["bash", "./test_date.sh"], 0x7ffc350f04b0 /* 25 vars */) = 0
>    214001 openat(AT_FDCWD, "./test_date.sh", O_RDONLY) = 3
>    214001 newfstatat(AT_FDCWD, "./test_date.sh", {st_mode=S_IFREG|0775, st_size=17, ...}, 0) = 0
>    214001 read(3, "date > /dev/null\n", 80) = 17
>    214001 read(255, "date > /dev/null\n", 17) = 17
>    214001 newfstatat(AT_FDCWD, "/usr/local/sbin/date", 0x7ffe85d5aa80, 0) = -1 ENOENT (没有那个文件或目录)
>    214001 newfstatat(AT_FDCWD, "/usr/local/bin/date", 0x7ffe85d5aa80, 0) = -1 ENOENT (没有那个文件或目录)
>    214001 newfstatat(AT_FDCWD, "/usr/sbin/date", 0x7ffe85d5aa80, 0) = -1 ENOENT (没有那个文件或目录)
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 access("/usr/bin/date", X_OK)    = 0
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 access("/usr/bin/date", R_OK)    = 0
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 access("/usr/bin/date", X_OK)    = 0
>    214001 newfstatat(AT_FDCWD, "/usr/bin/date", {st_mode=S_IFREG|0755, st_size=104968, ...}, 0) = 0
>    214001 access("/usr/bin/date", R_OK)    = 0
>    214008 execve("/usr/bin/date", ["date"], 0x5a3cfce71f70 /* 25 vars */) = 0
>    
>    ```
>
>    



## 内核信息和/proc

> 问题：
>
> 1. 你能找到内核命令行的proc文件吗?
>
>    ```shel
>    cat /proc/cmdline
>    BOOT_IMAGE=/boot/vmlinuz-6.8.0-65-generic root=UUID=23d3faea-ccb5-45c3-be38-1ed1adebaa00 ro quiet splash
>    ```
>
> 2. 使用`dmesg`和`grep`，你是否看到内核报告了内核命令行?
>
>    * 如果没有，你能确定内核的启动消息是否丢失了吗?
>    * 你的系统是否有记录启动消息的日志文件? 你可以在`/var/log`下使用grep搜索`BOOT_IMAGE`来查看。
>
>    ```shell
>    sudo dmesg | grep BOOT_IMAGE
>    
>    # jounalctl 检索systemd日志 -k（--demesg）仅显示内核日志
>    journalctl -k | grep BOOT_IMAGE
>    
>    grep -r BOOT_IMAGE /var/log
>    ```
>
>    
>
> 3. 根据`/proc/meminfo`，你的系统总共有多少RAM?
>
>    ```shell
>     head /proc/meminfo
>    MemTotal:        3961432 kB
>    MemFree:          112504 kB
>    MemAvailable:    2282668 kB
>    Buffers:           46112 kB
>    Cached:          2275048 kB
>    SwapCached:         6664 kB
>    Active:          1002672 kB
>    Inactive:        2191320 kB
>    Active(anon):     529920 kB
>    Inactive(anon):   369024 kB
>    
>    ```