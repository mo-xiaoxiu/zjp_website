# 📋 pkg-config文件介绍

## **什么是pkg-config文件？**

`pkg-config`是一个用于管理已安装库的元数据的工具。`.pc`文件是pkg-config的配置文件，包含了库的安装信息、编译选项和链接选项。

## **什么时候需要写.pc文件？**

### **✅ 需要写.pc文件的情况**

1. **开发库供他人使用**
   - 你的库会被其他项目依赖
   - 需要提供编译和链接信息

2. **跨平台兼容性**
   - 不同系统有不同的库路径
   - 需要自动检测库的位置

3. **简化用户使用**
   - 用户不需要手动指定`-I`、`-L`、`-l`参数
   - 自动处理依赖关系

4. **支持版本管理**
   - 指定库的版本要求
   - 处理API兼容性

### **❌ 不需要写.pc文件的情况**

1. **仅内部使用的库**
2. **简单的应用程序**
3. **使用现代构建系统（如CMake）**

## **📝 如何编写.pc文件**

### **基本结构**

```bash
# 安装路径信息
prefix=@CMAKE_INSTALL_PREFIX@
exec_prefix=${prefix}
includedir=${prefix}/include
libdir=${exec_prefix}/lib

# 库信息
Name: 库名称
Description: 库描述
Version: 版本号
URL: 项目网址（可选）

# 编译和链接选项
Libs: 链接选项
Cflags: 编译选项
Requires: 依赖库
```

### **ZJPThreadLoop.pc.in文件分析**

```bash
prefix=@CMAKE_INSTALL_PREFIX@          # 安装前缀
exec_prefix=${prefix}                   # 可执行文件前缀
includedir=${prefix}/include           # 头文件目录
libdir=${exec_prefix}/lib              # 库文件目录

Name: ZJPThreadLoop                     # 库名称
Description: A thread pool library with priority queue support  # 描述
Version: @PROJECT_VERSION@              # 版本号
Libs: -L${libdir} -lZJPsThreadLoop -lpthread  # 链接选项
Cflags: -I${includedir}                # 编译选项
Requires:                              # 依赖库（空）
```

## **CMake集成**

### **在CMakeLists.txt中配置**

```cmake
# 创建pkg-config文件
if(BUILD_SHARED_LIBS)
    configure_file(
        ${CMAKE_SOURCE_DIR}/cmake/ZJPThreadLoop.pc.in
        ${CMAKE_BINARY_DIR}/ZJPThreadLoop.pc
        @ONLY
    )
    install(FILES ${CMAKE_BINARY_DIR}/ZJPThreadLoop.pc 
            DESTINATION lib/pkgconfig)
endif()
```

### **安装规则**

```cmake
# 安装库文件
install(TARGETS ZJPThreadLoop_shared
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
    PUBLIC_HEADER DESTINATION include/ZJPThreadLoop
)

# 安装头文件
install(FILES ${HEADERS} DESTINATION include/ZJPThreadLoop)

# 安装pkg-config文件
install(FILES ${CMAKE_BINARY_DIR}/ZJPThreadLoop.pc 
        DESTINATION lib/pkgconfig)
```

## **🚀 用户如何使用**

### **编译时使用**

```bash
# 编译程序
g++ -std=c++17 your_program.cpp $(pkg-config --cflags --libs ZJPThreadLoop) -o your_program

# 或者分别获取
g++ -std=c++17 your_program.cpp $(pkg-config --cflags ZJPThreadLoop) $(pkg-config --libs ZJPThreadLoop) -o your_program
```

### **CMake中使用**

```cmake
# 查找pkg-config
find_package(PkgConfig REQUIRED)

# 查找库
pkg_check_modules(ZJPTHREADLOOP REQUIRED ZJPThreadLoop)

# 使用库
target_link_libraries(your_target ${ZJPTHREADLOOP_LIBRARIES})
target_include_directories(your_target PRIVATE ${ZJPTHREADLOOP_INCLUDE_DIRS})
target_compile_options(your_target PRIVATE ${ZJPTHREADLOOP_CFLAGS_OTHER})
```



