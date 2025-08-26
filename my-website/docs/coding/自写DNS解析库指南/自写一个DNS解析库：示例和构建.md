# 自写一个DNS解析库：示例和构建

前面的几篇文章已经把DNS解析库的框架、软件设计、类定义和接口实现等都介绍完成了，接下来我们需要更新一下库和代码的项目结构，以及构建编译、示例使用等。

## 目录更新

根据前面的设计和实现我们更新目录树如下：

```shell
.
├── CMakeLists.txt
├── examples
│   └── dns_example.cpp
├── include
│   ├── async_resolver.h
│   ├── dns_packet.h
│   ├── dns_parser.h
│   └── dns_resolver.h
├── README.md
├── src
│   ├── async_resolver.cpp
│   ├── dns_packet.cpp
│   ├── dns_parser.cpp
│   └── dns_resolver.cpp
├── tests
│   ├── CMakeLists.txt
│   └── dns_test.cpp
├── ZJPDnsConfig.cmake.in
└── zjpdns.pc.in
```

* `CMakeLists.txt`：构建的cmake
* `examples`：使用库的示例程序
* `include`：包含的头文件
  * `async_resolver.h`：异步解析器所在头文件
  * `dns_packet.h`：DNS包管理器所在头文件
  * `dns_parser.h`：DNS同步和异步解析器基类、创建同步和异步解析器接口所在头文件
  * `dns_resolver.h`：DNS同步和异步解析器实现类所在头文件
* `src`：`include`对应源文件
* `tests`：如果有更多的接口测试，可以放在这里
* `ZJPDnsConfig.cmake.in`：是一个 **CMake 包配置模板文件**，用于支持其他项目通过 `find_package()` 命令来查找和使用这个DNS解析库
* `zjpdns.pc.in`：**pkg-config 包配置模板文件**，用于支持基于 pkg-config 的依赖管理系统

## 构建

我们来看下这个库的cmake该怎么写。

* 我们希望能支持以静态库和动态库的方式进行编译，所以需要在cmake中设置选项；
* 我们需要将编译生成的库和头文件支持安装到用户指定的位置；
* 最好是支持自动传递编译依赖，在其他项目中使用的时候不需要写太多的语句去包含依赖
* 导出目标，提供命名空间的保护
* 支持pkg-config的依赖管理系统
* 支持编译测试程序和示例程序

**项目基础设置**

```cmake
cmake_minimum_required(VERSION 3.16)
```

* 指定所需的最低CMake版本为3.16，确保使用的CMake功能兼容性

```cmake
project(ZJPDnsParser VERSION 1.0.0 LANGUAGES CXX)
```

* 定义项目名称为`ZJPDnsParser`，版本号1.0.0，使用C++语言

**编译标准设置**

```cmake
set(CMAKE_CXX_STANDARD 17)
```

* 设置C++标准为C++17

```cmake
set(CMAKE_CXX_STANDARD_REQUIRED ON)
```

* 强制要求使用指定的C++标准，如果编译器不支持则报错

**构建选项**

```cmake
option(BUILD_SHARED_LIBS "Build shared libraries" ON)
option(BUILD_STATIC_LIBS "Build static libraries" ON)
```

* 默认开启构建动态库(.so文件)
* 默认开启构建静态库(.a文件)

**文件定义**

源文件

```cmake
set(SOURCES
    src/dns_parser.cpp
    src/dns_packet.cpp
    src/dns_resolver.cpp
    src/async_resolver.cpp
)
```

头文件

```cmake
set(HEADERS
    include/dns_parser.h
    include/dns_packet.h
    include/dns_resolver.h
    include/async_resolver.h
)
```

**动态库构建**

```cmake
if(BUILD_SHARED_LIBS)
    add_library(zjpdns_shared SHARED ${SOURCES})
```

* 如果启用动态库选项，创建名为`zjpdns_shared`的动态库目标

```cmake
    set_target_properties(zjpdns_shared PROPERTIES
        OUTPUT_NAME zjpdns
        VERSION ${PROJECT_VERSION}
        SOVERSION ${PROJECT_VERSION_MAJOR}
    )
```

* 设置动态库属性：

  * `OUTPUT_NAME`: 输出文件名为`zjpdns`，虽然目标名是 `zjpdns_shared`，但实际生成的文件名是 `libzjpdns.so`

  * `VERSION`: 完整版本号(1.0.0)，支持多版本共存

  * `SOVERSION`: 主版本号(1)，**创建符号链接 `libzjpdns.so.1 -> libzjpdns.so.1.0.0`**，程序运行时链接到 `libzjpdns.so.1`，在安装后会产生如下文件：

    ```shell
    /usr/local/lib/
    ├── libzjpdns.so -> libzjpdns.so.1        # 开发时链接
    ├── libzjpdns.so.1 -> libzjpdns.so.1.0.0  # 运行时链接  
    └── libzjpdns.so.1.0.0                    # 实际库文件
    ```

```cmake
    target_include_directories(zjpdns_shared PUBLIC 
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include> 
        $<INSTALL_INTERFACE:include>)
```

* 设置包含目录：
  * 构建时使用`${CMAKE_CURRENT_SOURCE_DIR}/include`
  * 安装后使用`include`

**静态库构建**

同动态库

**安装规则**

```cmake
install(TARGETS zjpdns_shared zjpdns_static
    EXPORT ZJPDnsTargets
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
    INCLUDES DESTINATION include
)
```

* 安装库文件：
  * `EXPORT`: 导出目标到`ZJPDnsTargets`
  * `LIBRARY`: 动态库安装到`lib/`
  * `ARCHIVE`: 静态库安装到`lib/`
  * `RUNTIME`: 运行时文件安装到`bin/`
  * `INCLUDES`: 包含目录设为`include/`

```cmake
install(FILES ${HEADERS} DESTINATION include/zjpdns)
```

* 安装头文件到`include/zjpdns/`目录

**目标导出**

```cmake
install(EXPORT ZJPDnsTargets
    FILE ZJPDnsTargets.cmake
    NAMESPACE ZJPDns::
    DESTINATION lib/cmake/ZJPDns
)
```

* 导出目标配置：

  * 生成`ZJPDnsTargets.cmake`文件
  * 添加命名空间`ZJPDns::`
  * 安装到`lib/cmake/ZJPDns/`

* 其他项目可以这样使用

  ```cmake
  # 其他项目的CMakeLists.txt
  find_package(ZJPDns REQUIRED)
  
  # 使用导出的目标
  target_link_libraries(my_app ZJPDns::zjpdns_shared)
  ```

**包配置文件**

```cmake
include(CMakePackageConfigHelpers)
```

* 包含CMake包配置助手模块

```cmake
write_basic_package_version_file(
    ZJPDnsConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY AnyNewerVersion
)
```

* 生成版本兼容性检查文件，允许任何更新版本

```cmake
configure_package_config_file(
    ZJPDnsConfig.cmake.in
    ZJPDnsConfig.cmake
    INSTALL_DESTINATION lib/cmake/ZJPDns
)
```

* 从模板生成包配置文件

```cmake
install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/ZJPDnsConfig.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/ZJPDnsConfigVersion.cmake
    DESTINATION lib/cmake/ZJPDns
)
```

* 安装生成的配置文件

**pkg-config支持**

```cmake
configure_file(zjpdns.pc.in zjpdns.pc @ONLY)
```

* 从模板生成pkg-config文件

```cmake
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/zjpdns.pc DESTINATION lib/pkgconfig)
```

* 安装pkg-config文件

**示例程序编译**

```cmake
add_executable(dns_example examples/dns_example.cpp)
if(BUILD_SHARED_LIBS)
    target_link_libraries(dns_example zjpdns_shared)
else()
    target_link_libraries(dns_example zjpdns_static)
endif()
```

* 链接库：优先使用动态库，否则使用静态库

**测试支持**

```cmake
enable_testing()
```

* 启用CMake测试功能

```cmake
add_subdirectory(tests)
```

* 添加测试子目录，处理`tests/CMakeLists.txt`

### 完整cmake

```cmake
cmake_minimum_required(VERSION 3.16)
project(ZJPDnsParser VERSION 1.0.0 LANGUAGES CXX)

# 设置C++标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 编译选项
option(BUILD_SHARED_LIBS "Build shared libraries" ON)
option(BUILD_STATIC_LIBS "Build static libraries" ON)

# 源文件
set(SOURCES
    src/dns_parser.cpp
    src/dns_packet.cpp
    src/dns_resolver.cpp
    src/async_resolver.cpp
)

set(HEADERS
    include/dns_parser.h
    include/dns_packet.h
    include/dns_resolver.h
    include/async_resolver.h
)

# 创建库
if(BUILD_SHARED_LIBS)
    add_library(zjpdns_shared SHARED ${SOURCES})
    set_target_properties(zjpdns_shared PROPERTIES
        OUTPUT_NAME zjpdns
        VERSION ${PROJECT_VERSION}
        SOVERSION ${PROJECT_VERSION_MAJOR}
    )
    target_include_directories(zjpdns_shared PUBLIC $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include> $<INSTALL_INTERFACE:include>)
endif()

if(BUILD_STATIC_LIBS)
    add_library(zjpdns_static STATIC ${SOURCES})
    set_target_properties(zjpdns_static PROPERTIES
        OUTPUT_NAME zjpdns
    )
    target_include_directories(zjpdns_static PUBLIC $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include> $<INSTALL_INTERFACE:include>)
endif()

# 安装规则
install(TARGETS zjpdns_shared zjpdns_static
    EXPORT ZJPDnsTargets
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
    INCLUDES DESTINATION include
)

install(FILES ${HEADERS} DESTINATION include/zjpdns)

# 导出目标
install(EXPORT ZJPDnsTargets
    FILE ZJPDnsTargets.cmake
    NAMESPACE ZJPDns::
    DESTINATION lib/cmake/ZJPDns
)

# 创建配置文件
include(CMakePackageConfigHelpers)
write_basic_package_version_file(
    ZJPDnsConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY AnyNewerVersion
)

configure_package_config_file(
    ZJPDnsConfig.cmake.in
    ZJPDnsConfig.cmake
    INSTALL_DESTINATION lib/cmake/ZJPDns
)

install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/ZJPDnsConfig.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/ZJPDnsConfigVersion.cmake
    DESTINATION lib/cmake/ZJPDns
)

# 创建pkg-config文件
configure_file(zjpdns.pc.in zjpdns.pc @ONLY)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/zjpdns.pc DESTINATION lib/pkgconfig)

# 示例程序
add_executable(dns_example examples/dns_example.cpp)
if(BUILD_SHARED_LIBS)
    target_link_libraries(dns_example zjpdns_shared)
else()
    target_link_libraries(dns_example zjpdns_static)
endif()

# 测试
enable_testing()
add_subdirectory(tests) 
```

### pkg-config

`zjpdns.pc.in`是一个 **pkg-config 包配置模板文件**，用于支持基于 pkg-config 的依赖管理系统。

**主要功能**

1. **pkg-config 支持**: 允许其他项目通过 `pkg-config` 工具查找和链接库
2. **编译参数提供**: 自动提供正确的头文件路径和链接参数
3. **跨平台兼容**: 支持 Linux/Unix 系统的标准包管理方式

```bash
prefix=@CMAKE_INSTALL_PREFIX@        # 安装前缀路径（CMake变量替换）
exec_prefix=${prefix}                # 可执行文件前缀
includedir=${prefix}/include         # 头文件目录
libdir=${exec_prefix}/lib           # 库文件目录

Name: zjpdns                        # 包名称
Description: ZJP DNS Parser Library # 包描述
Version: @PROJECT_VERSION@          # 版本号（CMake变量替换）
Cflags: -I${includedir}            # 编译标志（头文件路径）
Libs: -L${libdir} -lzjpdns         # 链接标志（库路径和库名）
```

**工作流程**

1. **构建时处理**: `CMakeLists.txt` 中的 `configure_file(zjpdns.pc.in zjpdns.pc @ONLY)` 将模板转换为实际配置文件
2. **安装**: 生成的 `zjpdns.pc` 被安装到 `lib/pkgconfig/` 目录
3. **使用**: 其他项目可以通过以下方式使用：

```bash
# 查询编译参数
pkg-config --cflags zjpdns
# 输出: -I/usr/local/include

# 查询链接参数  
pkg-config --libs zjpdns
# 输出: -L/usr/local/lib -lzjpdns

# 在Makefile中使用
CFLAGS += $(shell pkg-config --cflags zjpdns)
LDFLAGS += $(shell pkg-config --libs zjpdns)
```

**与CMake配置的区别**

- `ZJPDnsConfig.cmake.in`: 现代CMake项目使用，通过 `find_package()` 集成
- `zjpdns.pc.in`: 传统Unix/Linux项目使用，通过 `pkg-config` 工具集成

### cmake.in

`ZJPDnsConfig.cmake.in` 是一个 **CMake 包配置模板文件**，用于支持其他项目通过 `find_package()` 命令来查找和使用库。

**主要功能**

1. **包配置模板**: 这是一个模板文件，CMake 会在构建时将其处理成 `ZJPDnsConfig.cmake`
2. **依赖管理**: 允许其他项目轻松集成库
3. **目标导入**: 通过 `ZJPDnsTargets.cmake` 导入库的编译目标

```cmake
@PACKAGE_INIT@                                    # CMake 宏，初始化包配置
include("${CMAKE_CURRENT_LIST_DIR}/ZJPDnsTargets.cmake")  # 导入库目标定义
check_required_components(ZJPDns)                 # 检查必需组件
```

**工作流程**

1. **构建时处理**: CMakeLists.txt 中的 `configure_package_config_file()` 将模板转换为实际配置文件
2. **安装**: 生成的 `ZJPDnsConfig.cmake` 被安装到 `lib/cmake/ZJPDns/` 目录
3. **使用**: 其他项目可以通过以下方式使用：

```cmake
find_package(ZJPDns REQUIRED)
target_link_libraries(my_app ZJPDns::zjpdns)
```

### 编译安装

```shell
# 创建构建目录
mkdir build && cd build

# 配置编译选项
cmake .. -DCMAKE_BUILD_TYPE=Release

# 编译
make -j$(nproc)

# 安装
sudo make install
```



## 示例程序

在示例程序中，展示了我们这个DNS解析库的各自使用方式：

```cpp
#include "dns_parser.h"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <thread>

void printResult(const zjpdns::DnsResult& result) {
    std::cout << "query domain: ";
    if (result.domains.empty()) {
        std::cout << "no domain";
    } else {
        for (size_t i = 0; i < result.domains.size(); ++i) {
            if (i > 0) std::cout << ", ";
            std::cout << result.domains[i];
        }
    }
    std::cout << std::endl;
    std::cout << "resolve success: " << (result.success ? "yes" : "no") << std::endl;
    
    if (!result.success) {
        std::cout << "error message: " << result.error_message << std::endl;
        return;
    }
    
    std::cout << "IP addresses:" << std::endl;
    for (const auto& addr : result.addresses) {
        std::cout << "  " << addr << std::endl;
    }
    
    std::cout << "DNS records:" << std::endl;
    for (const auto& record : result.records) {
        std::cout << "  name: " << record.name << std::endl;
        std::cout << "  type: " << static_cast<int>(record.type) << std::endl;
        std::cout << "  class: " << static_cast<int>(record.class_) << std::endl;
        std::cout << "  TTL: " << record.ttl << std::endl;
        std::cout << "  data length: " << record.data.length() << std::endl;
        std::cout << "  ---" << std::endl;
    }
    std::cout << std::endl;
}

int main() {
    std::cout << "=== ZJP DNS parser example ===" << std::endl;
    
    // 创建同步解析器
    auto resolver = zjpdns::createDnsResolver();
    
    // 设置DNS服务器和超时
    resolver->setDnsServer("8.8.8.8", 53);
    resolver->setTimeout(5000);
    
    std::vector<std::string> domains = {
        "www.google.com",
        "www.baidu.com",
        "www.github.com"
    };
    
    // 测试同步解析
    std::cout << "=== sync resolve test ===" << std::endl;
    for (const auto& domain : domains) {
        std::cout << "resolve domain: " << domain << std::endl;
        
        // 使用gethostbyname方式
        auto result1 = resolver->resolve(domain, zjpdns::DnsRecordType::A, 
                                       zjpdns::ResolveMethod::GETHOSTBYNAME);
        std::cout << "gethostbyname method:" << std::endl;
        printResult(result1);
        
        // 使用DNS数据包方式
        auto result2 = resolver->resolve(domain, zjpdns::DnsRecordType::A, 
                                       zjpdns::ResolveMethod::DNS_PACKET);
        std::cout << "DNS packet method:" << std::endl;
        printResult(result2);
    }
    
    // 测试自定义DNS数据包
    std::cout << "=== custom DNS packet test ===" << std::endl;
    zjpdns::DnsPacket custom_packet;
    custom_packet.id = 12345;
    custom_packet.flags = 0x0100; // 标准查询
    custom_packet.qdcount = 1;
    custom_packet.questions.push_back("www.example.com");
    
    auto result3 = resolver->resolveWithPacket(custom_packet);
    std::cout << "custom DNS packet resolve:" << std::endl;
    printResult(result3);
    
    // 测试异步解析
    std::cout << "=== async resolve test ===" << std::endl;
    auto async_resolver = zjpdns::createAsyncDnsResolver();
    async_resolver->setDnsServer("8.8.8.8", 53);
    async_resolver->setTimeout(5000);
    
    std::vector<std::future<zjpdns::DnsResult>> futures;
    
    // 异步解析 使用默认DNS数据包方式
    for (const auto& domain : domains) {
        auto future = async_resolver->resolveAsync(domain, zjpdns::DnsRecordType::A, 
                                                 zjpdns::ResolveMethod::DNS_PACKET);
        futures.push_back(std::move(future));
    }
    
    // 等待所有解析完成
    for (size_t i = 0; i < futures.size(); ++i) {
        auto result = futures[i].get();
        std::cout << "async resolve " << domains[i] << ":" << std::endl;
        printResult(result);
    }

    // 测试gethostbyname异步解析
    std::cout << "=== gethostbyname async resolve test ===" << std::endl;
    auto gethostbyname_future = async_resolver->resolveAsync("www.google.com", zjpdns::DnsRecordType::A,
                                                            zjpdns::ResolveMethod::GETHOSTBYNAME);
    auto gethostbyname_result = gethostbyname_future.get();
    std::cout << "gethostbyname async resolve result:" << std::endl;
    printResult(gethostbyname_result);

    // 测试自定义数据包异步解析
    std::cout << "=== custom DNS packet async resolve test ===" << std::endl;
    auto custom_packet_future = async_resolver->resolveWithPacketAsync(custom_packet);
    auto custom_packet_result = custom_packet_future.get();
    std::cout << "custom DNS packet async resolve result:" << std::endl;
    printResult(custom_packet_result);

    // 测试默认DNS数据包回调式异步解析
    std::cout << "=== callback async resolve test ===" << std::endl;
    std::atomic<int> completed_count{0};
    int total_count = domains.size();
    
    for (const auto& domain : domains) {
        async_resolver->resolveWithCallback(domain, 
            [&completed_count, total_count](const zjpdns::DnsResult& result) {
                std::cout << "callback async resolve completed: ";
                if (!result.domains.empty()) {
                    std::cout << result.domains[0];
                } else {
                    std::cout << "no domain";
                }
                std::cout << std::endl;
                printResult(result);
                completed_count++;
                
                if (completed_count >= total_count) {
                    std::cout << "all callback async resolve completed!" << std::endl;
                }
            },
            zjpdns::DnsRecordType::A,
            zjpdns::ResolveMethod::DNS_PACKET);
    }
    
    // 等待回调完成
    while (completed_count < total_count) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    // 测试gethostbyname回调式异步解析
    std::cout << "=== gethostbyname callback async resolve test ===" << std::endl;
    completed_count.store(0);
    for (const auto& domain : domains) {
        async_resolver->resolveWithCallback(domain, 
            [&completed_count, total_count](const zjpdns::DnsResult& result) {
                std::cout << "callback async resolve completed: ";
                if (!result.domains.empty()) {
                    std::cout << result.domains[0];
                } else {
                    std::cout << "no domain";
                }
                std::cout << std::endl;
                printResult(result);
                completed_count++;
                
                if (completed_count >= total_count) {
                    std::cout << "all callback async resolve completed!" << std::endl;
                }
            },
            zjpdns::DnsRecordType::A,
            zjpdns::ResolveMethod::GETHOSTBYNAME);
    }

    while (completed_count < total_count) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    // 测试自定义数据包回调式异步解析
    std::cout << "=== test custom DNS packet callback async resolve ===" << std::endl;
    zjpdns::DnsPacket custom_packet2;
    custom_packet2.id = 54321;
    custom_packet2.flags = 0x0100; // 标准查询
    custom_packet2.qdcount = 1;
    custom_packet2.questions.push_back("www.example.com");
    
    std::atomic<bool> packet_callback_called{false};
    async_resolver->resolveWithPacketCallback(custom_packet2,
        [&packet_callback_called](const zjpdns::DnsResult& result) {
            std::cout << "custom DNS packet callback async resolve completed: ";
            if (!result.domains.empty()) {
                std::cout << result.domains[0];
            } else {
                std::cout << "no domain";
            }
            std::cout << std::endl;
            printResult(result);
            packet_callback_called = true;
        });
    
    // 等待自定义数据包回调完成
    while (!packet_callback_called) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    std::cout << "=== test completed ===" << std::endl;
    return 0;
} 
```

同步解析：

* `auto resolver = zjpdns::createDnsResolver();`创建DNS同步解析器
* 设置DNS服务器地址和超时时间
* `domian`这个vector包含了我们待解析的域名
* 调用`resolver->resolve(domain, zjpdns::DnsRecordType::A,zjpdns::ResolveMethod::GETHOSTBYNAME);`进行同步的`gethostbyname`解析
* `printResult`打印解析结果
* `resolver->resolve(domain, zjpdns::DnsRecordType::A,zjpdns::ResolveMethod::DNS_PACKET);`使用默认DNS数据包方式解析
* 自定义数据包同步解析

异步解析：

* `auto async_resolver = zjpdns::createAsyncDnsResolver();`创建异步解析器
* 设置DNS服务器地址和超时时间
* `....`

在前面cmake编译安装的基础上，我们会在`build`目录下找到`dns_examples`，执行它会看到如下输出：

```shell
=== ZJP DNS parser example ===
=== sync resolve test ===
resolve domain: www.google.com
gethostbyname method:
query domain: www.google.com
resolve success: yes
IP addresses:
  31.13.73.9
DNS records:
  name: www.google.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

DNS packet method:
query domain: www.google.com.
resolve success: yes
IP addresses:
  31.13.94.10
DNS records:
  name: www.google.com.
  type: 1
  class: 1
  TTL: 101
  data length: 4
  ---

resolve domain: www.baidu.com
gethostbyname method:
query domain: www.baidu.com
resolve success: yes
IP addresses:
  183.240.99.58
  183.240.99.169
DNS records:
  name: www.baidu.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---
  name: www.baidu.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

DNS packet method:
query domain: www.baidu.com.
resolve success: yes
IP addresses:
  103.235.46.102
  103.235.46.115
DNS records:
  name: www.baidu.com.
  type: 5
  class: 1
  TTL: 910
  data length: 15
  ---
  name: www.a.shifen.com.
  type: 5
  class: 1
  TTL: 22
  data length: 14
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 292
  data length: 4
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 292
  data length: 4
  ---

resolve domain: www.github.com
gethostbyname method:
query domain: www.github.com
resolve success: yes
IP addresses:
  20.205.243.166
DNS records:
  name: www.github.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

DNS packet method:
query domain: www.github.com.
resolve success: yes
IP addresses:
  20.205.243.166
DNS records:
  name: www.github.com.
  type: 5
  class: 1
  TTL: 3598
  data length: 2
  ---
  name: github.com.
  type: 1
  class: 1
  TTL: 60
  data length: 4
  ---

=== custom DNS packet test ===
custom DNS packet resolve:
query domain: www.example.com.
resolve success: yes
IP addresses:
  104.84.150.196
  104.84.150.167
DNS records:
  name: www.example.com.
  type: 5
  class: 1
  TTL: 34
  data length: 34
  ---
  name: www.example.com-v4.edgesuite.net.
  type: 5
  class: 1
  TTL: 15233
  data length: 20
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---

=== async resolve test ===
async resolve www.google.com:
query domain: www.google.com.
resolve success: yes
IP addresses:
  31.13.88.169
DNS records:
  name: www.google.com.
  type: 1
  class: 1
  TTL: 97
  data length: 4
  ---

async resolve www.baidu.com:
query domain: www.baidu.com.
resolve success: yes
IP addresses:
  103.235.46.102
  103.235.46.115
DNS records:
  name: www.baidu.com.
  type: 5
  class: 1
  TTL: 910
  data length: 15
  ---
  name: www.a.shifen.com.
  type: 5
  class: 1
  TTL: 22
  data length: 14
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 292
  data length: 4
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 292
  data length: 4
  ---

async resolve www.github.com:
query domain: www.github.com.
resolve success: yes
IP addresses:
  20.205.243.166
DNS records:
  name: www.github.com.
  type: 5
  class: 1
  TTL: 3573
  data length: 2
  ---
  name: github.com.
  type: 1
  class: 1
  TTL: 38
  data length: 4
  ---

=== gethostbyname async resolve test ===
gethostbyname async resolve result:
query domain: www.google.com
resolve success: yes
IP addresses:
  31.13.73.9
DNS records:
  name: www.google.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

=== custom DNS packet async resolve test ===
custom DNS packet async resolve result:
query domain: www.example.com.
resolve success: yes
IP addresses:
  104.84.150.196
  104.84.150.167
DNS records:
  name: www.example.com.
  type: 5
  class: 1
  TTL: 114
  data length: 34
  ---
  name: www.example.com-v4.edgesuite.net.
  type: 5
  class: 1
  TTL: 21104
  data length: 20
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---

=== callback async resolve test ===
callback async resolve completed: www.google.com.
query domain: www.google.com.
resolve success: yes
IP addresses:
  199.16.158.8
DNS records:
  name: www.google.com.
  type: 1
  class: 1
  TTL: 172
  data length: 4
  ---

callback async resolve completed: www.baidu.com.
query domain: www.baidu.com.
resolve success: yes
IP addresses:
  103.235.46.102
  103.235.46.115
DNS records:
  name: www.baidu.com.
  type: 5
  class: 1
  TTL: 1159
  data length: 15
  ---
  name: www.a.shifen.com.
  type: 5
  class: 1
  TTL: 18
  data length: 14
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 104
  data length: 4
  ---
  name: www.wshifen.com.
  type: 1
  class: 1
  TTL: 104
  data length: 4
  ---

callback async resolve completed: www.github.com.
query domain: www.github.com.
resolve success: yes
IP addresses:
  20.205.243.166
DNS records:
  name: www.github.com.
  type: 5
  class: 1
  TTL: 3573
  data length: 2
  ---
  name: github.com.
  type: 1
  class: 1
  TTL: 38
  data length: 4
  ---

all callback async resolve completed!
=== gethostbyname callback async resolve test ===
callback async resolve completed: www.google.com
query domain: www.google.com
resolve success: yes
IP addresses:
  31.13.73.9
DNS records:
  name: www.google.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

callback async resolve completed: www.baidu.com
query domain: www.baidu.com
resolve success: yes
IP addresses:
  183.240.99.169
  183.240.99.58
DNS records:
  name: www.baidu.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---
  name: www.baidu.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

callback async resolve completed: www.github.com
query domain: www.github.com
resolve success: yes
IP addresses:
  20.205.243.166
DNS records:
  name: www.github.com
  type: 1
  class: 1
  TTL: 300
  data length: 4
  ---

all callback async resolve completed!
=== test custom DNS packet callback async resolve ===
custom DNS packet callback async resolve completed: www.example.com.
query domain: www.example.com.
resolve success: yes
IP addresses:
  104.84.150.196
  104.84.150.167
DNS records:
  name: www.example.com.
  type: 5
  class: 1
  TTL: 144
  data length: 34
  ---
  name: www.example.com-v4.edgesuite.net.
  type: 5
  class: 1
  TTL: 17185
  data length: 20
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---
  name: a1422.dscr.akamai.net.
  type: 1
  class: 1
  TTL: 20
  data length: 4
  ---

=== test completed ===

```

---

**自写DNS解析库系列完结**。