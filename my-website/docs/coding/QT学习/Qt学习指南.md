# Qt记事本项目完整学习指南

## 项目概述

本项目是一个使用Qt6 C++开发的记事本应用程序，专为Qt初学者设计。通过实现Windows记事本的核心功能，系统学习Qt编程的基础概念和实践技巧。

### 项目特性
* ✅ 完整的文件操作（新建、打开、保存、另存为）
* ✅ 基本编辑功能（撤销、重做、剪切、复制、粘贴、全选）
* ✅ 字体设置和界面定制
* ✅ 窗口状态保存和恢复
* ✅ 文档修改状态管理
* ✅ 跨平台支持

## 项目架构设计

### MVC架构模式
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MainWindow    │────│   TextEditor     │────│   QSettings     │
│   (Controller)  │    │     (Model)      │    │    (Storage)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┼─── Qt Widgets (View)
                                 │
                    ┌─────────────┴─────────────┐
                    │  QMenuBar, QStatusBar,   │
                    │  QAction, QFileDialog    │
                    └───────────────────────────┘
```

### 项目文件结构
```
zjp-notepad/
├── CMakeLists.txt      # CMake构建配置
├── main.cpp           # 应用程序入口点
├── mainwindow.h       # 主窗口头文件
├── mainwindow.cpp     # 主窗口实现
├── texteditor.h       # 文本编辑器头文件
├── texteditor.cpp     # 文本编辑器实现
└── README.md          # 项目说明
```

## 核心组件详解

### 1. 应用程序入口（main.cpp）

```cpp
#include <QApplication>
#include "mainwindow.h"

int main(int argc, char *argv[])
{
    // 创建Qt应用程序对象
    QApplication app(argc, argv);
    
    // 设置应用程序基本信息
    app.setApplicationName("ZJP Notepad");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("ZJP");
    
    // 创建主窗口
    MainWindow window;
    window.show();
    
    // 进入事件循环
    return app.exec();
}
```

**关键概念**：
* **QApplication**：管理GUI应用程序的控制流和主要设置
* **事件循环**：`app.exec()`启动事件循环，处理用户交互
* **应用程序元数据**：用于QSettings自动选择配置文件存储位置

### 2. 主窗口类设计（MainWindow）

#### 类声明结构
```cpp
class MainWindow : public QMainWindow
{
    Q_OBJECT  // 启用Qt的信号槽机制

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    // 文件操作槽函数
    void newFile();
    void openFile();
    bool saveFile();
    void saveAsFile();
    
    // 编辑操作槽函数
    void undo();
    void redo();
    void cut();
    void copy();
    void paste();
    void selectAll();

private:
    // UI组件
    TextEditor *textEditor;
    
    // 菜单和动作
    QMenu *fileMenu;
    QAction *newAct;
    QAction *openAct;
    // ... 其他组件
};
```

#### 组件组织架构
```
MainWindow
├── TextEditor (中央组件)
├── QMenuBar (菜单栏)
│   ├── 文件菜单 (newAct, openAct, saveAct...)
│   ├── 编辑菜单 (undoAct, redoAct, cutAct...)
│   ├── 格式菜单 (fontAct...)
│   └── 帮助菜单 (aboutAct, aboutQtAct)
└── QStatusBar (状态栏)
```

### 3. 自定义文本编辑器（TextEditor）

```cpp
class TextEditor : public QTextEdit
{
    Q_OBJECT

public:
    explicit TextEditor(QWidget *parent = nullptr);
    bool isModified() const;
    void setModified(bool modified);
    void newDocument();

signals:
    void modificationChanged(bool changed);

private slots:
    void onTextChanged();

private:
    bool documentModified;
};
```

**设计原则**：
* **继承复用**：继承`QTextEdit`获得所有文本编辑功能
* **功能扩展**：添加文档修改状态管理
* **接口封装**：提供简洁的API给主窗口使用

## 操作流程交互图

### 1. 应用程序启动流程
```
┌─────────────────┐
│   main.cpp      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌──────────────────┐
│ QApplication    │    │ 设置应用程序信息  │
│ app(argc,argv)  │───▶│ setApplicationName│
└─────────────────┘    │ setVersion       │
          │            │ setOrganization  │
          │            └──────────────────┘
          ▼
┌─────────────────┐
│ MainWindow      │
│ window;         │
│ window.show();  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ app.exec()      │ ◄─── 进入事件循环
│ (事件循环开始)   │      等待用户交互
└─────────────────┘
```

### 2. 文件操作交互流程

#### 新建文件操作
```
用户点击"新建"菜单
          │
          ▼
┌─────────────────┐
│ QAction::       │
│ triggered       │ ◄─── 信号发射
│ (newAct)        │
└─────────┬───────┘
          │ connect连接
          ▼
┌─────────────────┐    ┌──────────────────┐
│ MainWindow::    │───▶│ maybeSave()      │
│ newFile()       │    │ 检查是否需要保存  │
└─────────────────┘    └─────────┬────────┘
          │                      │
          │              ┌───────▼────────┐
          │              │ 用户选择保存?   │
          │              └───────┬────────┘
          │                      │ 是
          │              ┌───────▼────────┐
          │              │ saveFile()     │
          │              └────────────────┘
          ▼
┌─────────────────┐    ┌──────────────────┐
│ textEditor->    │───▶│ setCurrentFile   │
│ newDocument()   │    │ (QString())      │
└─────────────────┘    └──────────────────┘
```

### 3. 文档修改状态管理流程
```
用户在编辑器中输入文字
          │
          ▼
┌─────────────────┐
│ QTextEdit::     │ ◄─── Qt内置信号
│ textChanged     │
└─────────┬───────┘
          │ connect连接
          ▼
┌─────────────────┐    ┌──────────────────┐
│ TextEditor::    │───▶│ setModified(true)│
│ onTextChanged() │    └─────────┬────────┘
└─────────────────┘              │
          │                      ▼
          │            ┌──────────────────┐
          │            │ emit             │
          │            │ modificationChanged│ ◄─── 自定义信号
          │            │ (true)           │
          │            └─────────┬────────┘
          │                      │ connect连接
          ▼                      ▼
┌─────────────────┐    ┌──────────────────┐
│ documentModified│    │ MainWindow::     │
│ = true          │    │ documentWasModified│
└─────────────────┘    └─────────┬────────┘
                                 │
                                 ▼
                       ┌──────────────────┐
                       │ setWindowModified│
                       │ (true)           │ ◄─── 窗口标题显示*
                       └──────────────────┘
```

## Qt语法和编程模式总结

### 1. Qt类定义基本语法

```cpp
class MainWindow : public QMainWindow  // 公有继承Qt基类
{
    Q_OBJECT  // 必须！启用Qt元对象系统（信号槽、属性、反射）

public:
    explicit MainWindow(QWidget *parent = nullptr);  // 构造函数
    ~MainWindow();  // 析构函数

protected:
    void closeEvent(QCloseEvent *event) override;  // 重写事件处理

private slots:  // 槽函数声明
    void newFile();
    bool saveFile();

signals:  // 信号声明（仅在头文件中声明，不需要实现）
    void documentChanged(bool modified);

private:
    // 私有成员变量和函数
};
```

### 2. 信号槽机制语法

#### 槽函数声明
```cpp
private slots:    // 私有槽函数
    void onButtonClicked();
    
public slots:     // 公有槽函数
    void setVisible(bool visible);
```

#### 信号槽连接语法
```cpp
// 现代Qt5+语法（推荐）
connect(sender, &SenderClass::signalName, 
        receiver, &ReceiverClass::slotName);

// 处理函数重载
connect(saveAct, &QAction::triggered, 
        this, QOverload<>::of(&MainWindow::saveFile));

// Lambda表达式槽
connect(button, &QPushButton::clicked, [this]() {
    // 处理逻辑
});
```

### 3. 组件创建和使用模式

```cpp
// 在构造函数中创建组件
MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)  // 初始化列表
{
    // 创建子组件，指定父对象
    textEditor = new TextEditor(this);
    newAct = new QAction(tr("新建(&N)"), this);
    
    // 设置中央组件
    setCentralWidget(textEditor);
}
```

### 4. 事件处理语法

```cpp
protected:
    void closeEvent(QCloseEvent *event) override;

// 实现
void MainWindow::closeEvent(QCloseEvent *event)
{
    if (maybeSave()) {
        event->accept();  // 接受事件
    } else {
        event->ignore();  // 忽略事件
    }
}
```

### 5. 文件操作标准模式

```cpp
// 文件对话框
QString fileName = QFileDialog::getOpenFileName(
    this,                                    // 父窗口
    tr("打开文件"),                          // 标题
    QString(),                               // 默认路径
    tr("文本文件 (*.txt);;所有文件 (*)")     // 过滤器
);

// 安全文件写入
QSaveFile file(fileName);
if (file.open(QFile::WriteOnly | QFile::Text)) {
    QTextStream out(&file);
    out << textContent;
    file.commit();  // 原子提交
}
```

### 6. 设置管理语法

```cpp
void MainWindow::readSettings()
{
    QSettings settings;  // 自动选择存储位置
    QByteArray geometry = settings.value("geometry", QByteArray()).toByteArray();
    if (!geometry.isEmpty()) {
        restoreGeometry(geometry);
    }
}

void MainWindow::writeSettings()
{
    QSettings settings;
    settings.setValue("geometry", saveGeometry());
}
```

## CMake构建系统

```cmake
cmake_minimum_required(VERSION 3.16)
project(ZJPNotepad VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找Qt6包
find_package(Qt6 REQUIRED COMPONENTS Core Widgets)

# 启用Qt的MOC（Meta-Object Compiler）
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# 源文件
set(SOURCES
    main.cpp
    mainwindow.cpp
    texteditor.cpp
)

# 创建可执行文件
add_executable(ZJPNotepad ${SOURCES} ${HEADERS})

# 链接Qt库
target_link_libraries(ZJPNotepad Qt6::Core Qt6::Widgets)
```

**关键概念**：
* **MOC（Meta-Object Compiler）**：Qt的预处理器，处理`Q_OBJECT`宏
* **AUTOMOC**：CMake自动检测包含`Q_OBJECT`的头文件并运行MOC

## Qt核心设计理念

### 1. 信号槽通信机制
* **松耦合**：发送者和接收者不需要直接了解对方
* **类型安全**：编译时检查参数匹配
* **多对多连接**：一个信号可以连接多个槽，一个槽可以接收多个信号

### 2. 对象树内存管理
* **父子关系**：Qt使用父子关系自动管理内存
* **RAII原则**：父对象销毁时自动销毁所有子对象
* **避免内存泄漏**：无需手动delete Qt对象

### 3. 事件驱动编程
* **事件循环**：应用程序在事件循环中等待和处理事件
* **事件处理**：通过重写虚函数或信号槽处理事件
* **异步处理**：事件系统支持异步操作

### 4. 跨平台一致性
* **统一API**：相同的代码在不同平台上表现一致
* **本地化支持**：自动适配平台特定的UI风格和行为
* **设置管理**：QSettings自动选择平台合适的存储位置

## 学习要点总结

### 必须掌握的语法
1. **Q_OBJECT宏**：每个使用信号槽的类都必须包含
2. **信号槽连接**：使用现代connect语法避免运行时错误
3. **父子关系**：创建Qt对象时指定父对象，自动内存管理
4. **事件重写**：使用override关键字明确标识
5. **翻译支持**：所有用户可见字符串使用tr()包装

### 设计模式应用
* **观察者模式**：信号槽机制
* **命令模式**：QAction封装用户操作
* **模板方法模式**：事件处理虚函数重写
* **单例模式**：QApplication应用程序对象

### 扩展功能建议
基于当前架构，可以轻松添加：
1. **查找替换对话框**
2. **最近文件列表**
3. **行号显示**
4. **语法高亮**
5. **多标签页支持**
6. **打印功能**

## 构建和运行

### 构建步骤
```bash
mkdir build
cd build
cmake ..
cmake --build .
```

### 运行程序
```bash
./ZJPNotepad      # Linux/macOS
ZJPNotepad.exe    # Windows
```

## 总结

这个Qt记事本项目展示了Qt框架的核心特性和编程模式。通过实现一个完整的桌面应用程序，你学习了：

* Qt应用程序的基本结构和生命周期
* 信号槽机制的使用和原理
* 事件处理和用户交互
* 文件操作和错误处理
* 跨平台设置管理
* 自定义组件开发
* CMake构建系统

掌握这些概念后，你就具备了开发更复杂Qt应用程序的基础。Qt的强大之处在于其一致的API设计和丰富的组件库，这使得开发跨平台桌面应用程序变得简单而高效。
