# root权限为何还无法写文件

在对WalnutPi 2B进行试验时，发生在root权限下文件突然无法操作的问题，在此记录下解决方案：

## 问题描述和解决

我想要在`/boot/start`下创建一个遍历`/home/pi/test`下的可执行程序并启动监控进程执行各个进程的脚本`progress_manager.sh`，由于执行过程中估计是异常断电导致文件系统出了点问题，使其无法在root权限下被操作，并且也无法写入内容，显示只读文件：

```shell
root@WalnutPi:/boot/start# lsattr progress_manager.sh
lsattr: Operation not supported While reading flags on progress_manager.sh

root@WalnutPi:/boot/start# rm progress_manager.sh
rm: cannot remove 'progress_manager.sh': Read-only file system
```

经过尝试，执行以下指令可以解决：

```shell
mount -o remount -rw /boot
```

由此可以推断，在异常断上电的时候导致文件系统的挂载出现了点问题，重新挂载为可读写后即可解决。

## 梳理

* 文件分区的读写属性查看：

  ```shell
  mount
  ```

  如：

  ```shell
  mount | grep boot
  
  /dev/mmcblk0p1 on /boot type vfat (rw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=iso8859-1,shortname=mixed,errors=remount-ro)
  ```

