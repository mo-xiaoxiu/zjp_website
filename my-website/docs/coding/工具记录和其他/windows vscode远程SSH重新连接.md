# windows vscode远程SSH重新连接

由于之前在windows的vscode上连接过旧的服务器ip地址，旧的服务器现在重新刷了镜像，但是还是用的之前的ip，导致vscode重新连接远程SSH连接不上。在此记录下解决方法防止遗忘。

## 解决方法

在windows的`C:\user\用户名\.ssh\`下，有三个文件，分别是`config`、`known_hosts`和`known_hosts.old`，如下：

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250312092722.png)

将打开各个文件，将旧的服务器的配置删除，保存，并重启vscode即可。