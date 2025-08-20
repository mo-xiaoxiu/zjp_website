# 自写一个DNS解析库

之前在项目上经常会有需要用到DNS解析域名的时候，如果每次调用`gethostbyname`可能会使得项目代码出现很多相似的处理代码，且对于需要异步解析的DNS请求来说，还需要额外编码，自我感觉不是很方便；使用第三方库虽好，但是难免会陷入选择和依赖太多或过大的境地，当然了，也不是所有的库都选择自己实现，视情况而定。自己实现一个相对简单一点的DNS解析库可以很好适配公司或者自己项目的软件架构，且能学习和巩固到写库的一些手段，何乐而不为呢？

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/DNS解析库开发1.png)

## 需求

我希望自己写的DNS解析库能尽量满足实际使用过程中的需求，目前我期望：

* 支持DNS同步解析
  * 使用`gethostbyname`的方式解析
  * 使用发送默认构建`UDP`包的方式解析
  * 支持用户自定义DNS字段的方式解析
* 支持DNS异步解析
  * 使用`gethostbyname`的方式解析
  * 使用发送默认构建`UDP`包的方式解析
  * 支持用户自定义DNS字段的方式解析

我要求这个库能从`gethostbyname`系统调用和在应用层构建DNS请求数据包发送的方式，解析DNS。我考虑到，有时候我们项目上可以直接使用较为简单的解析方式，即直接使用`gethostbyname`的方式，但是有时候又不希望解析过程在没有返回之前阻塞住我们的主应用，所以在进程资源满足的情况下可以适当使用异步解析，通过回调的方式回传解析好的ip地址。

但是在某些工况下，比如嵌入式设备的休眠唤醒阶段，本地DNS服务器地址还没写入系统配置，我们在高实时响应的场景下，进行网络请求，涉及到DNS解析的时候，如果使用系统默认的`gethostbyname`这种方式就会导致找不到本地DNS服务器地址而让DNS请求发送不出去。这种使用我们可以使用构建DNS请求数据包的方式发送。综合以上场景，还是最好提供以上说明的同步和异步两套接口会好一些。

## 接口定义

依据以上需求，我需要定义同步解析和异步解析两套接口。我们进行DNS解析的时候，一般需要传入以下信息：

* `Domain`：域名
* `ipv4`or`ipv6`：是对ipv4还是ipv6地址的查询
* `way`：以何种方式进行解析，就是我上面说的：`gethostbyname`还是构建数据包的方式

同步解析接口：

```cpp
// 使用gethostbyname方式
resolve(domain, DnsRecordType::A, ResolveMethod::GETHOSTBYNAME);

// 使用默认DNS数据包方式
resolve(domain, DnsRecordType::A, ResolveMethod::DNS_PACKET);

// 使用自定义DNS数据包方式
DnsPacket custom_packet;
custom_packet.id = 12345;
custom_packet.flags = 0x0100; // 标准查询
custom_packet.qdcount = 1;
custom_packet.questions.push_back("www.example.com");
resolveWithPacket(custom_packet);
```

异步解析接口：

```cpp
// 使用gethostbyname异步解析
gethostbyname_future = resolveAsync("www.google.com", DnsRecordType::A, ResolveMethod::GETHOSTBYNAME);
gethostbyname_future.get();   // 获取结果，在C++上可以使用future

// 使用自定义DNS数据包的方式
custom_packet_future = resolveWithPacketAsync(custom_packet);
custom_packet_future.get();

// 使用默认DNS数据包方式
default_packet_future = resolveAsync(domain, DnsRecordType::A, ResolveMethod::DNS_PACKET);
default_packet_future.get();

// 使用默认DNS数据包 + 回调方式
resolveWithCallback(domain, [callback], DnsRecordType::A, ResolveMethod::DNS_PACKET);

// 使用gethostbyname + 回调方式
resolveWithCallback(domain, [callback], DnsRecordType::A, ResolveMethod::GETHOSTBYNAME);

// 使用自定义DNS数据包 + 回到方式
resolveWithPacketCallback(custom_packet, [callback]);
```

可以看到，以上接口的异步解析部分，我又增加了回调的方式，还是基于考虑到项目上会使用的原因。



## 环境

这里简单介绍下我使用的环境：

* Ubuntu：对版本一般没有特殊要求
* CMake：最好是最新的，这个库我要求最低是3.16
* g++：最好也是最新的
* C++：我们使用C++ 11/14/17



## 目录结构

一般库的目录我理解是长这样的，当然应该还有其他形式：

```shell
include -- 包含头文件

src -- 包含源文件

examples -- 示例文件

CMakeLists -- 构建cmake

README.md -- 构建和使用指南

....
```



下一篇介绍初步的框架搭建。