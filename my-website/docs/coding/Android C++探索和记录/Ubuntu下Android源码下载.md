# Ubuntu下Android源码下载

## 环境

```shell
uname -a
Linux zjp2-VMware-Virtual-Platform 6.11.0-26-generic #26~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Thu Apr 17 19:20:47 UTC 2 x86_64 x86_64 x86_64 GNU/Linux

```

## 准备

安装git和curl

```shell
sudo apt update && sudo apt install git curl
```

Android源码需要安装Java环境

```shell
sudo apt install openjdk-11-jdk
```

构建必要的工具链

```shell
sudo apt install flex bison gperf libsdl2-dev libssl-dev libncurses5-dev
```

## Repo

下载repo

```shell
mkdir ~/bin   # 文件夹可能本身就存在，可以cd看看
PATH=~/bin:$PATH
curl -sSL 'https://gerrit-googlesource.proxy.ustclug.org/git-repo/+/master/repo?format=TEXT' | base64 -di > ~/bin/repo
chmod a+x ~/bin/repo
```

确保repo安装ok，显示类似输出

```shell
repo --version
/home/zjp2/bin/repo:635: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  now = datetime.datetime.utcnow()
<repo not installed>
repo launcher version 2.8
       (from /home/zjp2/bin/repo)
git 2.43.0
Python 3.12.3 (main, Feb  4 2025, 14:48:35) [GCC 13.3.0]
OS Linux 6.11.0-26-generic (#26~24.04.1-Ubuntu SMP PREEMPT_DYNAMIC Thu Apr 17 19:20:47 UTC 2)
CPU x86_64 (x86_64)

```

repo初始化

```shell
# 设置 REPO_URL 环境变量指向清华镜像
export REPO_URL='https://mirrors.tuna.tsinghua.edu.cn/git/git-repo'

# 重新执行 repo init
repo init -u https://aosp.tuna.tsinghua.edu.cn/platform/manifest -b android-14.0.0_r1
```

显示类似如下输出：

```shell
/home/zjp2/bin/repo:635: DeprecationWarning: datetime.datetime.utcnow() is deprecated and scheduled for removal in a future version. Use timezone-aware objects to represent datetimes in UTC: datetime.datetime.now(datetime.UTC).
  now = datetime.datetime.utcnow()

... A new version of repo (2.54) is available.
... You should upgrade soon:
    cp /home/zjp2/android/.repo/repo/repo /home/zjp2/bin/repo

repo: reusing existing repo client checkout in /home/zjp2/android

Testing colorized output (for 'repo diff', 'repo status'):
  black    red      green    yellow   blue     magenta   cyan     white 
  bold     dim      ul       reverse 
Enable color display in this user account (y/N)? y

repo has been initialized in /home/zjp2/android

```

之后使用repo同步代码

```shell
repo sync -j8 --fail-fast
```

