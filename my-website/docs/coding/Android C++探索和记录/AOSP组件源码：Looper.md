# AOSP组件源码：Looper

套用源码注释的一段话描述清楚`Looper`：

> 一个支持监控文件描述符事件的轮询循环，可选择使用回调。该实现内部使用`epoll()`。*Looper可以与线程关联，虽然没有要求必须这样做。*

## Looper组件

AOSP 的 `Looper`是一个极其核心的**事件循环 (Event Loop)** 机制，位于 `frameworks/native/libs/utils/`和 `system/core/libutils/`。

### 职责与设计

AOSP 的 `Looper`是一个**高效的 I/O 多路复用器与消息调度器**。它的核心设计哲学是：**让一个线程能够无限循环，阻塞等待多个输入源（文件描述符）上的事件，一旦事件发生，便分发并处理它们，从而实现单线程内的异步、非阻塞操作。**

### 工作原理与三要素

其工作模型围绕三个关键要素构建：

1. **监听源 (File Descriptors)**:
   * Looper 的核心是监听 **文件描述符 (fd)** 上的事件。在 Linux 中，一切皆文件，socket、管道 (pipe)、标准输入输出、Binder 驱动提供的 fd 等都可以被 Looper 监听。
   * 常见事件类型包括：
     * `EVENT_INPUT`: 文件描述符上有数据可读。
     * `EVENT_OUTPUT`: 文件描述符可写入。
     * `EVENT_ERROR`: 文件描述符发生错误。
2. **事件循环 (Loop)**:
   * 线程通过调用 `Looper::pollOnce()`或 `Looper::pollAll()`进入一个无限循环。
   * 在这个循环内，它会使用 **`epoll`**来同时监视所有注册了的文件描述符。
   * 此调用是**阻塞的**。线程会在此休眠，直到以下情况发生：
     * 某个被监听的 fd 发生了感兴趣的事件。
     * 设定的超时时间已到。
     * 被其他线程通过 `Looper::wake()`唤醒。
3. **回调处理 (Callback)**:
   * 当 `pollOnce`因 fd 事件而返回时，Looper 会查找与该 fd 关联的**回调函数** (`Looper_callbackFunc`)。
   * 然后，它会在**当前线程**（即运行 Looper 的线程）同步执行这个回调函数，从而处理事件。
   * 回调函数的返回值决定 Looper 后续是否继续监听此 fd：返回 `1`继续监听，返回 `0`则移除监听。

### 特性与能力

* **线程单例性**: 每个线程最多只能拥有一个 Looper 对象，通过 `Looper::getForThread()`和 `Looper::setForThread()`管理，确保了线程内事件处理的秩序。
* **精准唤醒**: 任何线程都可以通过调用另一个线程的 Looper 的 `wake()`方法，精确地唤醒目标线程的 `pollOnce`调用。这是实现跨线程任务同步和优雅退出的关键。
* **超时控制**: `pollOnce`支持传入超时参数，允许循环在无事件时定期唤醒执行一些逻辑（如处理超时任务）。

## 源码分析

我们首先来看下头文件，其中有几个数据结构需要澄清：

```cpp
typedef int (*Looper_callbackFunc)(int fd, int events, void* data);

/**
 * A message that can be posted to a Looper.
 */
struct Message {
    Message() : what(0) { }
    Message(int w) : what(w) { }

    /* The message type. (interpretation is left up to the handler) */
    int what;
};
```

* `Looper_callbackFunc`Lopper的回调函数类型
* `Message`供Looper使用的消息结构

```cpp
class MessageHandler : public virtual RefBase {
protected:
    virtual ~MessageHandler();

public:
    /**
     * Handles a message.
     */
    virtual void handleMessage(const Message& message) = 0;
};
```

需要用户重写实现`handleMessage`的`MessageHandler`：`handleMessage`用于获取消息之后的处理

```cpp
/**
 * A simple proxy that holds a weak reference to a message handler.
 */
class WeakMessageHandler : public MessageHandler {
protected:
    virtual ~WeakMessageHandler();

public:
    WeakMessageHandler(const wp<MessageHandler>& handler);
    virtual void handleMessage(const Message& message);

private:
    wp<MessageHandler> mHandler;
};
```

`WeakMessageHandler`相当于`MessageHandler`的弱引用，其中有个`wp`类型为`MessageHandler`的成员mHandler，用于把持`MessageHandler`的弱引用

```cpp
class LooperCallback : public virtual RefBase {
protected:
    virtual ~LooperCallback();

public:
    /**
     * Handles a poll event for the given file descriptor.
     * It is given the file descriptor it is associated with,
     * a bitmask of the poll events that were triggered (typically EVENT_INPUT),
     * and the data pointer that was originally supplied.
     *
     * Implementations should return 1 to continue receiving callbacks, or 0
     * to have this file descriptor and callback unregistered from the looper.
     */
    virtual int handleEvent(int fd, int events, void* data) = 0;
};
```

处理**指定文件描述符**的轮询事件：

* 接收与其关联的文件描述符、已触发的轮询事件的位掩码（通常是 EVENT_INPUT）、以及数据指针

```cpp
class SimpleLooperCallback : public LooperCallback {
protected:
    virtual ~SimpleLooperCallback();

public:
    SimpleLooperCallback(Looper_callbackFunc callback);
    virtual int handleEvent(int fd, int events, void* data);

private:
    Looper_callbackFunc mCallback;
};
```

封装前面的`Looper_callbackFunc`类型：通过`Looper_callbackFunc` + `LooperCallback`包装成一个简单的指定文件描述符的轮询事件器。应该是为了方便用户使用。

以上这些结构和类型都是服务于消息传输和任务执行的，接下来看下`Looper`的声明

```cpp
class Looper : public RefBase {
protected:
    virtual ~Looper();

public:
    enum {
        /**
         * Result from Looper_pollOnce() and Looper_pollAll():
         * The poll was awoken using wake() before the timeout expired
         * and no callbacks were executed and no other file descriptors were ready.
         */
        POLL_WAKE = -1,

        /**
         * Result from Looper_pollOnce() and Looper_pollAll():
         * One or more callbacks were executed.
         */
        POLL_CALLBACK = -2,

        /**
         * Result from Looper_pollOnce() and Looper_pollAll():
         * The timeout expired.
         */
        POLL_TIMEOUT = -3,

        /**
         * Result from Looper_pollOnce() and Looper_pollAll():
         * An error occurred.
         */
        POLL_ERROR = -4,
    };
};
```

`POLL_WAKE`，`POLL_CALLBACK`，`POLL_TIMEOUT`，`POLL_ERROR`都是`pollOnce`和`pollAll`的返回值类型，对应着不同的处理

```cpp
class Looper: public Refbase {
public:
    enum {
        /**
         * The file descriptor is available for read operations.
         */
        EVENT_INPUT = 1 << 0,

        /**
         * The file descriptor is available for write operations.
         */
        EVENT_OUTPUT = 1 << 1,

        /**
         * The file descriptor has encountered an error condition.
         *
         * The looper always sends notifications about errors; it is not necessary
         * to specify this event flag in the requested event set.
         */
        EVENT_ERROR = 1 << 2,

        /**
         * The file descriptor was hung up.
         * For example, indicates that the remote end of a pipe or socket was closed.
         *
         * The looper always sends notifications about hangups; it is not necessary
         * to specify this event flag in the requested event set.
         */
        EVENT_HANGUP = 1 << 3,

        /**
         * The file descriptor is invalid.
         * For example, the file descriptor was closed prematurely.
         *
         * The looper always sends notifications about invalid file descriptors; it is not necessary
         * to specify this event flag in the requested event set.
         */
        EVENT_INVALID = 1 << 4,
    };
};
```

以上注释也说明了枚举的用处，主要是文件描述符的事件类型

接下来我们可以移步到源文件看看各个函数的实现。

