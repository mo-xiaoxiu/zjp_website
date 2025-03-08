# std::move和std::forward的区别

`std::move`一般用于C++中的移动语义；`std::forward`一般用于完美转发。

## 背景知识

在此之前先说明两个概念：左值和右值

* **左值**

  - **定义**：左值是一个表达式，它表示一个持久的对象，可以取地址，并且可以出现在赋值运算符的左侧。

  - **特点**：
    - 可以取地址（使用`&`运算符）。
    - 可以多次使用。
    - 通常表示一个有名字的变量。

  - **示例**：

    ```cpp
    int a = 10;
    int& ref = a;  // a是一个左值，可以取地址，可以多次使用
    int* ptr = &a; // 可以取a的地址
    ```

* **右值**

  - **定义**：右值是一个表达式，它表示一个临时的对象，不能取地址，并且通常只能出现在赋值运算符的右侧。

  - **特点**：
    - 不能取地址（使用`&`运算符会导致编译错误）。
    - 通常是临时的，生命周期较短。
    - 通常表示一个无名字的临时对象。

  - **示例**：

    ```cpp
    int b = 10 + 20;  // 10 + 20是一个右值，不能取地址，是临时的
    int c = b;        // b是一个左值，但在这里作为右值使用
    ```

* **左值引用和右值引用**

  - **左值引用（lvalue reference）**：

    - 用`&`表示，只能绑定到左值。

    - 通常用于函数参数，表示对传入对象的引用，避免复制。

    - 示例：

      ```cpp
      void print(int& x) {
          std::cout << x << std::endl;
      }
      int a = 10;
      print(a);  // a是一个左值，可以绑定到左值引用
      ```

  - **右值引用（rvalue reference）**：

    - 用`&&`表示，只能绑定到右值。

    - 通常用于移动构造函数和移动赋值函数，表示对临时对象的引用，允许“窃取”资源。

    - 示例：

      ```cpp
      class Person {
      public:
          Person(Person&& other) : name(other.name), age(other.age) {
              other.name = nullptr;
              other.age = 0;
          }
      };
      Person p1("Alice", 30);
      Person p2 = std::move(p1);  // std::move将p1转换为右值，可以绑定到右值引用
      ```

还需要提到一个很重要的概念：**引用折叠**

引用折叠的规则如下：

* 左值引用的右值引用-->左值引用：`T& &&`-->`T&`
* 左值引用的左值引用-->左值引用：`T& &`-->`T&`
* 右值引用的左值引用-->左值引用：`T&& &`-->`T&`
* 右值引用的右值引用-->右值引用：`T&& &&`-->`T&&`

## 移动语义

在一些类对象的使用场景中，我们可能需要将这个类对象的所有权或生命周期转移到另一个对象，原对象不需要再使用了。在移动语义出来之前，我们一般使用拷贝语义：

```cpp
#include <iostream>
#include <cstring>

class Person {
private:
    char* name;
    int age;

public:
    // 构造函数
    Person(const char* name, int age) {
        this->name = new char[strlen(name) + 1];
        strcpy(this->name, name);
        this->age = age;
    }

    // 拷贝构造函数
    Person(const Person& other) {
        // 首先为name分配内存，大小与other.name相同
        this->name = new char[strlen(other.name) + 1];
        // 然后复制字符串内容
        strcpy(this->name, other.name);
        // 直接复制age的值
        this->age = other.age;
    }

    // 析构函数
    ~Person() {
        delete[] name;  // 释放name指向的内存
    }

    // 打印信息的函数
    void printInfo() const {
        std::cout << "Name: " << name << ", Age: " << age << std::endl;
    }
};

int main() {
    Person p1("Alice", 30);
    Person p2 = p1;  // 调用拷贝构造函数

    p1.printInfo();  // 输出：Name: Alice, Age: 30
    p2.printInfo();  // 输出：Name: Alice, Age: 30

    return 0;
}
```

如果有了移动语义我们可以在这个类里边增加一个移动拷贝构造，并再使用时传递右值，这样就可以将原类对象的资源转移到另一类而无需消耗过大的拷贝开销：

```cpp
#include <iostream>
#include <cstring>

class Person {
private:
    char* name;
    int age;

public:
    // 构造函数
    Person(const char* name, int age) {
        this->name = new char[strlen(name) + 1];
        strcpy(this->name, name);
        this->age = age;
    }

    // 拷贝构造函数
    Person(const Person& other) {
        this->name = new char[strlen(other.name) + 1];
        strcpy(this->name, other.name);
        this->age = other.age;
    }

    // 移动构造函数
    Person(Person&& other) noexcept : name(other.name), age(other.age) {
        other.name = nullptr;  // 将源对象的资源置为空，防止析构时释放
        other.age = 0;         // 可选，将年龄设置为0或其它默认值
    }

    // 析构函数
    ~Person() {
        delete[] name;  // 释放name指向的内存
    }

    // 打印信息的函数
    void printInfo() const {
        std::cout << "Name: " << (name ? name : "nullptr") << ", Age: " << age << std::endl;
    }
};

int main() {
    Person p1("Alice", 30);
    Person p2 = std::move(p1);  // 明确调用移动构造函数

    p1.printInfo();  // 输出：Name: nullptr, Age: 0
    p2.printInfo();  // 输出：Name: Alice, Age: 30

    return 0;
}
```

这里值得注意的是：

1. 在`Person`中增加了移动构造函数之后，我们需要将移动构造函数指定为`noexcept`，即不抛出异常的，否则编译器默认调用的还是拷贝构造函数
2. 在使用移动构造时还需要调用`std::move`
3. 移动赋值函数也是如此，以下给出示例：

```cpp
// 拷贝赋值函数
    Person& operator=(const Person& other) {
        if (this != &other) {
            char* newName = new char[strlen(other.name) + 1];
            strcpy(newName, other.name);
            delete[] name;
            name = newName;
            age = other.age;
        }
        return *this;
    }

    // 移动赋值函数
    Person& operator=(Person&& other) noexcept {
        if (this != &other) {
            delete[] name;
            name = other.name;
            age = other.age;
            other.name = nullptr;
            other.age = 0;
        }
        return *this;
    }
```

**这里需要注意的是，在移动赋值函数里边，要先判断是否时自赋值！否则可能会出现：**

* 出现悬空指针：先释放了name的内存，然后再把other（其实就是本对象）的name赋值过来，其实就是将一个已经释放了的指针赋值给自己，现在name这个指针就是悬空指针
* double free：在出现悬空指针的前提下，如果对象释放调用了析构函数，析构函数里边会对name进行再次释放
* 如果类中没有需要深拷贝的成员，且赋值函数里边写成`*this = other`（虽然一般不会写成这样），则可能会导致循环调用赋值函数导致堆栈溢出哦

### std::move实现

```cpp

template <typename T>
typename remove_reference<T>::type&& move(T&& t)
{
	return static_cast<typename remove_reference<T>::type&&>(t);
}
```

* 传递左值引用`T&`，则根据引用折叠规则`T& &&`将会推到成左值引用`T&`
* `remove_reference`将传递进去的左值引用`T&`去除引用特性，即变成`T`，再转换成右值引用`T&&`

## 完美转发

完美转发旨在对函数调用时传递参数到内部时保持原有的值类型，即左值传递进去就是左值，右值传递进去还是右值

```cpp
#include <iostream>
#include <utility>  // 包含std::forward

// process函数，处理左值
void process(const std::string& str) {
    std::cout << "Processing lvalue: " << str << std::endl;
}

// process函数，处理右值
void process(std::string&& str) {
    std::cout << "Processing rvalue: " << str << std::endl;
}

// 模板函数，使用std::forward实现完美转发
template<typename T>
void callWithForward(T&& arg) { //T&& 万能引用
    process(std::forward<T>(arg));
}

int main() {
    std::string name = "Alice";

    // 传递左值
    callWithForward(name);  // 输出: Processing lvalue: Alice

    // 传递右值
    callWithForward(std::string("Bob"));  // 输出: Processing rvalue: Bob

    // 传递左值引用
    std::string& ref = name;
    callWithForward(ref);  // 输出: Processing lvalue: Alice

    // 传递右值引用
    std::string&& rref = std::move(name);
    callWithForward(rref);  // 输出: Processing rvalue: Alice

    return 0;
}
```

### std::forward实现

```cpp
template<typename _Tp>
    constexpr _Tp&&
    forward(typename std::remove_reference<_Tp>::type& __t) noexcept
    { return static_cast<_Tp&&>(__t); }

template<typename _Tp>
    constexpr _Tp&&
    forward(typename std::remove_reference<_Tp>::type&& __t) noexcept
    {
      static_assert(!std::is_lvalue_reference<_Tp>::value,
	  "std::forward must not be used to convert an rvalue to an lvalue");
      return static_cast<_Tp&&>(__t);
    }
```

* `std::forward`实现了传入左值引用和右值引用的重载
* 使用`remove_reference`去掉类型的引用特性，根据引用折叠规则：
  * 对于传入左值引用重载，传入左值使用`static_cast`将类型根据引用折叠`T& &&`转换成左值`T&`
  * 对于传入右值引用重载，传入右值使用`static_cast`将类型根据引用折叠`T&& &&`转换成右值`T&&`



## 总结

* 语义
  * `std::move`用于实现移动语义
  * `std::forward`用于实现完美转发
* 使用
  * `std::move`：在类实现了移动构造或者移动赋值的情况下（指定不抛出异常），使用`std::move`能将传入的左值或右值转成右值，达到移动对象资源的功能
  * `std::forward`：一般作为函数参数转发使用，需要声明为类模板使用（也可以直接模板实例化时指定类型使用），将传入或转发的参数保留其值类别，即传入左值经过转发还是左值，传入右值经过转发还是右值
* 实现
  * `std::move`实现上为一个函数模板，传入的参数指定为任意类型的右值引用，即`T&&`，也称之为万能引用；函数内部实现先将传入的任意类型去除引用特性之后取其值类别，即`T`，再使用`static_cast`转换为右值引用，即`T&&`并返回
  * `std::forward`实现上为一个函数模板，提供了两种重载，分别是传入左值引用的重载和传入右值引用的重载；对传入左值引用的实现上，先将传入的参数去除引用特性之后取其类别，即`T`，再转换为左值引用，即`T&`，再使用`static_cast`将`T&`转化为`T& &&`，根据引用折叠规则转换为左值引用，即`T&`，最后返回；对传入右值引用的实现上，先将传入的参数去除引用特性之后取其类别，即`T`，再转换为右值引用，即`T&&`，再使用`static_cast`将`T&&`转换为`T&& &&`，根据引用折叠规则转换为右值引用，即`T&&`，最后返回



