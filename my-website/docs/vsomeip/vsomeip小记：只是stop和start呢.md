# vsomeip小记：只是stop和start呢

在使用vsomeip的时候，我们的嵌入式设备经常会遇到休眠唤醒需要停止offer数据或停止订阅数据等等操作。对于offer类型的报文，作为提供数据的服务端的停止和开始总是伴随如下步骤：

## 初始化流程

```cpp
bool init() {
        std::lock_guard<std::mutex> its_lock(mutex_);

        if (!app_->init()) {
            std::cerr << "Couldn't initialize application" << std::endl;
            return false;
        }
        app_->register_state_handler(
                std::bind(&service_sample::on_state, this,
                        std::placeholders::_1));

        app_->register_message_handler(
                SAMPLE_SERVICE_ID,
                SAMPLE_INSTANCE_ID,
                SAMPLE_GET_METHOD_ID,
                std::bind(&service_sample::on_get, this,
                          std::placeholders::_1));

        app_->register_message_handler(
                SAMPLE_SERVICE_ID,
                SAMPLE_INSTANCE_ID,
                SAMPLE_SET_METHOD_ID,
                std::bind(&service_sample::on_set, this,
                          std::placeholders::_1));

        std::set<vsomeip::eventgroup_t> its_groups;
        its_groups.insert(SAMPLE_EVENTGROUP_ID);
        app_->offer_event(
                SAMPLE_SERVICE_ID,
                SAMPLE_INSTANCE_ID,
                SAMPLE_EVENT_ID,
                its_groups,
                vsomeip::event_type_e::ET_FIELD, std::chrono::milliseconds::zero(),
                false, true, nullptr, vsomeip::reliability_type_e::RT_UNKNOWN);
        {
            std::lock_guard<std::mutex> its_lock(payload_mutex_);
            payload_ = vsomeip::runtime::get()->create_payload();
        }

        blocked_ = true;
        condition_.notify_one();
        return true;
    }
```

* 初始化：`app_->init`
* 注册状态回调：` app_->register_state_handler`，表示app的初始化等动作ok了
* 注册消息处理回调：`app_->register_message_handler`
* offer事件：`app_->offer_event`将想要提供的服务对应的事件添加到事件集合/列表

在`notify_sample`里边，会开始运行`offer`所在thread，offer对应的服务，并且周期地发送数据：

```cpp
void run() {
        std::unique_lock<std::mutex> its_lock(mutex_);
        while (!blocked_)
            condition_.wait(its_lock);

        //...
        offer();
    }

void offer() {
        std::lock_guard<std::mutex> its_lock(notify_mutex_);
        app_->offer_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        is_offered_ = true;
        notify_condition_.notify_one();
    }

void notify() {

        vsomeip::byte_t its_data[10];
        uint32_t its_size = 1;

        while (running_) {
            std::unique_lock<std::mutex> its_lock(notify_mutex_);
            while (!is_offered_ && running_)
                notify_condition_.wait(its_lock);
            while (is_offered_ && running_) {
                if (its_size == sizeof(its_data))
                    its_size = 1;

                for (uint32_t i = 0; i < its_size; ++i)
                    its_data[i] = static_cast<uint8_t>(i);

                {
                    std::lock_guard<std::mutex> its_lock(payload_mutex_);
                    payload_->set_data(its_data, its_size);

                    std::cout << "Setting event (Length=" << std::dec << its_size << ")." << std::endl;
                    app_->notify(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID, payload_);
                }

                its_size++;

                std::this_thread::sleep_for(std::chrono::milliseconds(cycle_));
            }
        }
    }
```



## 开启

在适当的时机可以通过调用start来开启SOME/IP的通信：

```cpp
void start() {
        app_->start();
    }
```



## 停止

当我们想要停止SOME/IP的通信时，往往是这样的：

```cpp
void stop() {
        running_ = false;
        blocked_ = true;
        condition_.notify_one();
        notify_condition_.notify_one();
        app_->clear_all_handler();
        stop_offer();
        if (std::this_thread::get_id() != offer_thread_.get_id()) {
            if (offer_thread_.joinable()) {
                offer_thread_.join();
            }
        } else {
            offer_thread_.detach();
        }
        if (std::this_thread::get_id() != notify_thread_.get_id()) {
            if (notify_thread_.joinable()) {
                notify_thread_.join();
            }
        } else {
            notify_thread_.detach();
        }
        app_->stop();
    }

void stop_offer() {
        app_->stop_offer_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        is_offered_ = false;
    }
```

* 清理所有注册的处理回调：`app_->clear_all_handler`
* 停止offer服务：`app_->stop_offer_service`
* 停止app的通信操作：`app_->stop`

在`notify_sample`示例程序里边，会将offer服务和发送数据所在线程的运行结束掉

## 能否在停止时只stop呢？

这不免引起我的思考：能否在我想停止的时候只调用`app_->stop`，然后在重新开启的时候调用`app_->stat`，不去做过多的操作呢？

我们可以修改这个`notify_sample`来试验一下：

```cpp
//在类中增加两个测试的成员函数
void testStart() {
        blocked_ = true;
        condition_.notify_one();
        start();
    }

    void testStop() {
        blocked_ = true;
        condition_.notify_one();
        notify_condition_.notify_one();
        app_->stop();
    }

//修改main
int main(int argc, char **argv) {
    uint32_t cycle = 1000; // default 1s

    setenv("VSOMEIP_CONFIGURATION", "./vsomeip-local.json", 1);
    setenv("VSOMEIP_APPLICATION_NAME", "service-sample", 1);

    std::string cycle_arg("--cycle");

    for (int i = 1; i < argc; i++) {
        if (cycle_arg == argv[i] && i + 1 < argc) {
            i++;
            std::stringstream converter;
            converter << argv[i];
            converter >> cycle;
        }
    }

    service_sample its_sample(cycle);
#ifndef VSOMEIP_ENABLE_SIGNAL_HANDLING
    its_sample_ptr = &its_sample;
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
#endif
    if (its_sample.init()) {
        //在另外一个线程中定期执行我们测试的停止和开启的动作
        std::thread t([&its_sample]() {
            std::this_thread::sleep_for(std::chrono::seconds(10));
            its_sample.testStop();
            std::cout << "Stopped" << std::endl;
            std::this_thread::sleep_for(std::chrono::seconds(10));
            its_sample.testStart();
            std::cout << "Started" << std::endl;
        });

        its_sample.start();

        //等待测试线程执行完毕再真正退出
        t.join();
#ifdef VSOMEIP_ENABLE_SIGNAL_HANDLING
        its_sample.stop();
#endif
        return 0;
    } else {
        return 1;
    }
}
```

修改点如下：

* 在`service_sample`里边增加两个用于测试的成员函数`testStart`和`testStop`，里边的核心调用分别是`app_->start`和`app_->stop`
* 在main函数中，开启另外一个线程，用于测试：测试线程延迟10s，主线程先执行start；等待10s时间到，测试线程执行testStop停止，主线程的start动作结束，继续往下执行，到t.join需要等待测试程序执行完毕；测试线程在停止运行SOME/IP之后延迟10s，执行testStart重新运行SOME/IP

终端运行结果如下：

```shell
~/git_pro/someip/vsomeip/build/examples$ ./notify-sample 
2025-03-10 13:08:16.395338 service-sample [warning] Reliability type for event [1234.5678.777] was not configured Using : RT_UNRELIABLE
2025-03-10 13:08:16.395908 service-sample [warning] Reliability type for event [1234.5678.778] was not configured Using : RT_UNRELIABLE
2025-03-10 13:08:16.395958 service-sample [warning] Reliability type for event [1234.5678.779] was not configured Using : RT_UNRELIABLE
2025-03-10 13:08:16.396728 service-sample [info] Using configuration file: "./vsomeip-local.json".
2025-03-10 13:08:16.396773 service-sample [info] Parsed vsomeip configuration in 0ms
2025-03-10 13:08:16.396863 service-sample [info] Configuration module loaded.
2025-03-10 13:08:16.396935 service-sample [info] Security disabled!
2025-03-10 13:08:16.396966 service-sample [info] Initializing vsomeip (3.5.4) application "service-sample".
2025-03-10 13:08:16.397515 service-sample [info] Instantiating routing manager [Host].
2025-03-10 13:08:16.398739 service-sample [info] create_routing_root: Routing root @ /tmp/vsomeip-0
2025-03-10 13:08:16.399287 service-sample [info] Service Discovery enabled. Trying to load module.
2025-03-10 13:08:16.401419 service-sample [info] Service Discovery module loaded.
2025-03-10 13:08:16.401808 service-sample [info] Application(service-sample, 1277) is initialized (11, 100).
2025-03-10 13:08:16.401927 service-sample [info] offer_event: Event [1234.5678.8778] uses configured cycle time 0ms
2025-03-10 13:08:16.402131 service-sample [info] REGISTER EVENT(1277): [1234.5678.8778:is_provider=true]
2025-03-10 13:08:16.403081 service-sample [info] Starting vsomeip application "service-sample" (1277) using 2 threads I/O nice 0
2025-03-10 13:08:16.403620 service-sample [debug] Thread created. Number of active threads for service-sample : 1
2025-03-10 13:08:16.405617 service-sample [info] Client [1277] routes unicast:172.20.10.13, netmask:255.255.255.0
2025-03-10 13:08:16.404272 service-sample [info] main dispatch thread id from application: 1277 (service-sample) is: 7740f23fb6c0 TID: 15918
2025-03-10 13:08:16.405780 service-sample [info] shutdown thread id from application: 1277 (service-sample) is: 7740f1bfa6c0 TID: 15919
2025-03-10 13:08:16.404265 service-sample [info] rmi::offer_service added service: 1234 to pending_sd_offers_.size = 1
2025-03-10 13:08:16.409464 service-sample [info] routing_manager_stub::on_offer_service: ON_OFFER_SERVICE(1277): [1234.5678:0.0]
2025-03-10 13:08:16.407409 service-sample [info] Watchdog is disabled!
2025-03-10 13:08:16.412007 service-sample [info] io thread id from application: 1277 (service-sample) is: 7740f4f4fb80 TID: 15913
Application service-sample is registered.
2025-03-10 13:08:16.413703 service-sample [info] io thread id from application: 1277 (service-sample) is: 7740ebfff6c0 TID: 15922
2025-03-10 13:08:16.414137 service-sample [info] vSomeIP 3.5.4 | (default)
2025-03-10 13:08:16.414147 service-sample [info] create_local_server: Listening @ /tmp/vsomeip-1277
2025-03-10 13:08:16.414545 service-sample [info] OFFER(1277): [1234.5678:0.0] (true)
2025-03-10 13:08:16.414579 service-sample [warning] Network interface "ens33" state changed: up
2025-03-10 13:08:16.415395 service-sample [warning] Route "default route (0.0.0.0/0) if: ens33 gw: 172.20.10.1" state changed: up
Setting event (Length=1).
2025-03-10 13:08:16.416454 service-sample [debug] Joining to multicast group 224.244.224.0 from 172.20.10.13
2025-03-10 13:08:16.417509 service-sample [info] rmi::start_ip_routing: clear pending_sd_offers_
2025-03-10 13:08:16.417795 service-sample [info] SOME/IP routing ready.
2025-03-10 13:08:16.418136 service-sample [info] udp_server_endpoint_impl<multicast>: SO_RCVBUF is: 212992 (1703936) local port:30490
Setting event (Length=2).
Setting event (Length=3).
Setting event (Length=4).
Setting event (Length=5).
Setting event (Length=6).
Setting event (Length=7).
Setting event (Length=8).
Setting event (Length=9).
Setting event (Length=1).
2025-03-10 13:08:26.405950 service-sample [info] Stopping vsomeip application "service-sample" (1277).
2025-03-10 13:08:26.409717 service-sample [debug] Thread destroyed. Number of active threads for service-sample : 0
Stopped
Setting event (Length=2).
Setting event (Length=3).
Setting event (Length=4).
Setting event (Length=5).
Setting event (Length=6).
Setting event (Length=7).
Setting event (Length=8).
Setting event (Length=9).
Setting event (Length=1).
Setting event (Length=2).
2025-03-10 13:08:36.436864 service-sample [info] Starting vsomeip application "service-sample" (1277) using 2 threads I/O nice 0
2025-03-10 13:08:36.438912 service-sample [debug] Thread created. Number of active threads for service-sample : 1
2025-03-10 13:08:36.439754 service-sample [info] Client [1277] routes unicast:172.20.10.13, netmask:255.255.255.0
2025-03-10 13:08:36.441384 service-sample [info] main dispatch thread id from application: 1277 (service-sample) is: 7740f1bfa6c0 TID: 16004
Application service-sample is deregistered.
2025-03-10 13:08:36.441514 service-sample [info] create_routing_root: Routing root @ /tmp/vsomeip-0
2025-03-10 13:08:36.442222 service-sample [info] shutdown thread id from application: 1277 (service-sample) is: 7740ebfff6c0 TID: 16005
2025-03-10 13:08:36.453396 service-sample [info] Watchdog is disabled!
Application service-sample is registered.
2025-03-10 13:08:36.456254 service-sample [info] io thread id from application: 1277 (service-sample) is: 7740f23fb6c0 TID: 16008
2025-03-10 13:08:36.456572 service-sample [info] io thread id from application: 1277 (service-sample) is: 7740f2bfc6c0 TID: 15917
2025-03-10 13:08:36.457072 service-sample [info] vSomeIP 3.5.4 | (default)
Setting event (Length=3).
Setting event (Length=4).
Setting event (Length=5).
Setting event (Length=6).
Setting event (Length=7).
Setting event (Length=8).
Setting event (Length=9).
Setting event (Length=1).
Setting event (Length=2).
Setting event (Length=3).
2025-03-10 13:08:46.470486 service-sample [info] vSomeIP 3.5.4 | (default)
Setting event (Length=4).
Setting event (Length=5).
Setting event (Length=6).
Setting event (Length=7).
Setting event (Length=8).
Setting event (Length=9).
Setting event (Length=1).
Setting event (Length=2).
Setting event (Length=3).
Setting event (Length=4).
2025-03-10 13:08:56.482729 service-sample [info] vSomeIP 3.5.4 | (default)
Setting event (Length=5).

```

* 第一次的stop的时间是在`13:08:26`
* 再次开始运行的时间是在`13:08:36`

抓取数据包观察：

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250310134903.png)

重新开始运行之后不会再按照第一次那样发送offer报文，这是有问题的。

### 分析

对比前后两次start的日志信息：

* 我们没有在stop的时候停止offer，所以第二次start的日志中没有是正常的
* 少了sd组件的相关启动日志

接下来可以移步到`app`关于start和stop的接口实现：

```cpp
void application_impl::start() {
    //...
    {
        std::lock_guard<std::mutex> its_lock(start_stop_mutex_);
        if (io_.stopped()) {
            io_.reset();
        } else if(stop_thread_.joinable()) {
            VSOMEIP_ERROR << "Trying to start an already started application.";
            return;
        }
        if (stopped_) {
            {
                std::lock_guard<std::mutex> its_lock_start_stop(block_stop_mutex_);
                block_stopping_ = true;
                block_stop_cv_.notify_all();
            }

            stopped_ = false;
            return;
        }
        stopped_ = false;
        stopped_called_ = false;
        VSOMEIP_INFO << "Starting vsomeip application \"" << name_ << "\" ("
                << std::hex << std::setfill('0') << std::setw(4) << client_
                << ") using "  << std::dec << io_thread_count << " threads"
#if defined(__linux__) || defined(ANDROID) || defined(__QNX__)
                << " I/O nice " << io_thread_nice_level
#endif
        ;
        
        //...
        if (routing_)
            routing_->start();
        
    }
 	//...   
}

void application_impl::stop() {
    VSOMEIP_INFO << "Stopping vsomeip application \"" << name_ << "\" ("
                << std::hex << std::setfill('0') << std::setw(4) << client_ << ").";

    bool block = true;
    {
        std::lock_guard<std::mutex> its_lock_start_stop(start_stop_mutex_);
        if (stopped_ || stopped_called_) {
            return;
        }
        stop_caller_id_ = std::this_thread::get_id();
        stopped_ = true;
        stopped_called_ = true;
        for (const auto& thread : io_threads_) {
            if (thread->get_id() == std::this_thread::get_id()) {
                block = false;
            }
        }
        if (start_caller_id_ == stop_caller_id_) {
            block = false;
        }
    }
	//...
    {
        std::lock_guard<std::mutex> its_lock_start_stop(start_stop_mutex_);
        stop_cv_.notify_one();
    }

    if (block) {
        std::unique_lock<std::mutex> block_stop_lock(block_stop_mutex_);
        block_stop_cv_.wait_for(block_stop_lock, std::chrono::milliseconds(1000),
                                [this] { return block_stopping_.load(); });
        block_stopping_ = false;
    }
}
```

可以看下关键部分：

对于start接口来说：

* 如果io线程停止，则重新开始
* 会加锁判断此时是否stop的状态，如果是，则会通知stop所在线程先阻塞stop之后就返回了
* 在后面会**开启路由管理器**

路由管理器的start的操作：

```cpp
void routing_manager_impl::start() {
    //...
    netlink_connector_ = std::make_shared<netlink_connector>(
            host_->get_io(), configuration_->get_unicast_address(), its_multicast);
    netlink_connector_->register_net_if_changes_handler(
            std::bind(&routing_manager_impl::on_net_interface_or_route_state_changed,
            this, std::placeholders::_1, std::placeholders::_2, std::placeholders::_3));
    netlink_connector_->start();
    //...
     if (stub_)
        stub_->start();
    host_->on_state(state_type_e::ST_REGISTERED);
}

void routing_manager_impl::on_net_interface_or_route_state_changed(
	//...
    if (!routing_running_ && is_external_routing_ready()) {
        start_ip_routing();
    }
    //...
}
    
void routing_manager_impl::start_ip_routing() {
#if defined(_WIN32) || defined(__QNX__)
    if_state_running_ = true;
#endif

    if (routing_ready_handler_) {
        routing_ready_handler_();
    }

    if (discovery_) {
        if (!is_suspended()) {
            discovery_->start();
        }
    } else {
        init_routing_info();
    }

 //...
    routing_running_ = true;
    VSOMEIP_INFO << VSOMEIP_ROUTING_READY_MESSAGE;
}

//routing stub
void routing_manager_stub::start() {
    #if defined(__linux__) || defined(ANDROID)
    if (configuration_->is_local_routing()) {
#else
    {
#endif // __linux__ || ANDROID
        if (!root_) {
            // application has been stopped and started again
            init_routing_endpoint();
        }
        if (root_) {
            root_->start();
        }
}
        

```

* 注册网卡ready或者组播路由ready的处理程序
  * 网卡ready或者组播路由ready的处理程序：最终会调用`start_ip_routing`
  * `start_ip_routing`最终会调用sd组件的`start`
* 开启`stub`的`start`
  * 初始化通信端点，开启通信

对于stop接口来说：

* 会把`stop`标志位置位上
* 通知`shutdown`来做退出的一些操作
* 可以看到stop的时候是可以等待在`block_stop_cv_`处的

我们看下`shundown`的操作：

```cpp
void application_impl::shutdown() {
    //...
    {
        std::unique_lock<std::mutex> its_lock(start_stop_mutex_);
        while(!stopped_) {
            stop_cv_.wait(its_lock);
        }
    }
    //...
    try {
        if (routing_)
            routing_->stop();
    } catch (const std::exception &e) {
        VSOMEIP_ERROR << "application_impl::" << __func__ << ": stopping routing, "
                << " catched exception: " << e.what();
    }
    //...
}
```

* shutdown在接收到`stop_cv_`信号之后继续往下执行
* **停止routing**路由管理器
  * 最终会调用sd组件的`stop`和`stub`的`stop`

### 梳理和结论

* 调用`app_->stop`的时候调用`routing_->stop`，且会把stop标志位置为true
* `routing_->stop`最终会调用sd组件的stop和`stub_->stop`，导致停发offer服务
* 再次调用`app_->start`，判断stop标志位是否为true；此时判断为true，所以告诉调用stop的线程先等待，然后无其他动作直接返回
* 没有重新启动`routing_`，导致再次调用`app_->start`时没有再次按照规则发送offer服务

> 虽然sd组件层和routing路由管理器层都有做接口部分相应的解耦，但是application这部分还有有一些调用依赖的。

**最好是严格按照调用示例调用。**