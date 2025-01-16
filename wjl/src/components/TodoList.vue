<template>
  <div class="todo-container">
    <!-- 标题 -->
    <h1 class="title">待办事项清单</h1>
    
    <!-- 输入框部分 -->
    <div class="input-wrapper">
      <input 
        type="text" 
        v-model="newTodo" 
        @keyup.enter="addTodo"
        placeholder="请输入待办事项..."
        class="todo-input"
      >
      <button @click="addTodo" class="add-btn">添加</button>
    </div>

    <!-- 待办事项列表 -->
    <ul class="todo-list">
      <li v-for="(todo, index) in todos" 
          :key="index" 
          :class="{'completed': todo.completed}"
          class="todo-item">
        <input 
          type="checkbox" 
          v-model="todo.completed"
          class="todo-checkbox"
        >
        <span class="todo-text">{{ todo.text }}</span>
        <button @click="removeTodo(index)" class="delete-btn">删除</button>
      </li>
    </ul>

    <!-- 统计信息 -->
    <div class="todo-stats" v-if="todos.length > 0">
      <span>总计: {{ todos.length }} 项</span>
      <span>已完成: {{ completedCount }} 项</span>
    </div>
  </div>
</template>

<script>
/**
 * @component TodoList
 * @description 待办事项清单组件，支持添加、删除、标记完成等功能
 */
export default {
  name: 'TodoList',
  data() {
    return {
      /**
       * @property {string} newTodo - 新待办事项的输入值
       */
      newTodo: '',
      /**
       * @property {Array} todos - 待办事项列表
       * @type {Array<{text: string, completed: boolean}>}
       */
      todos: []
    }
  },
  computed: {
    /**
     * @computed completedCount
     * @returns {number} 已完成的待办事项数量
     */
    completedCount() {
      return this.todos.filter(todo => todo.completed).length
    }
  },
  methods: {
    /**
     * @method addTodo
     * @description 添加新的待办事项
     */
    addTodo() {
      if (this.newTodo.trim()) {
        this.todos.push({
          text: this.newTodo.trim(),
          completed: false
        })
        this.newTodo = ''
        this.saveTodos()
      }
    },
    /**
     * @method removeTodo
     * @param {number} index - 要删除的待办事项索引
     */
    removeTodo(index) {
      this.todos.splice(index, 1)
      this.saveTodos()
    },
    /**
     * @method saveTodos
     * @description 将待办事项保存到本地存储
     */
    saveTodos() {
      localStorage.setItem('todos', JSON.stringify(this.todos))
    },
    /**
     * @method loadTodos
     * @description 从本地存储加载待办事项
     */
    loadTodos() {
      const savedTodos = localStorage.getItem('todos')
      if (savedTodos) {
        this.todos = JSON.parse(savedTodos)
      }
    }
  },
  /**
   * @lifecycle mounted
   * @description 组件挂载时加载保存的待办事项
   */
  mounted() {
    this.loadTodos()
  },
  /**
   * @watch todos
   * @description 监听待办事项变化，自动保存到本地存储
   */
  watch: {
    todos: {
      handler() {
        this.saveTodos()
      },
      deep: true
    }
  }
}
</script>

<style lang="scss" scoped>
// 颜色变量
$primary-color: #42b983;
$danger-color: #dc3545;
$text-color: #2c3e50;
$border-color: #ddd;
$bg-light: #f8f9fa;
$bg-white: #fff;
$text-muted: #666;

// 间距变量
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 2rem;

// 过渡动画
$transition-duration: 0.3s;

// 混合器 - 按钮基础样式
@mixin button-base {
  padding: $spacing-md 1.5rem;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background $transition-duration;
}

.todo-container {
  max-width: 600px;
  margin: $spacing-lg auto;
  padding: $spacing-lg;
  background: $bg-white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  color: $text-color;
  margin-bottom: $spacing-lg;
}

.input-wrapper {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;

  .todo-input {
    flex: 1;
    padding: 0.8rem;
    border: 1px solid $border-color;
    border-radius: 4px;
    font-size: 1rem;

    &:focus {
      outline: none;
      border-color: $primary-color;
    }
  }

  .add-btn {
    @include button-base;
    background: $primary-color;

    &:hover {
      background: darken($primary-color, 5%);
    }
  }
}

.todo-list {
  list-style: none;
  padding: 0;

  .todo-item {
    display: flex;
    align-items: center;
    padding: $spacing-md;
    background: $bg-light;
    margin-bottom: $spacing-sm;
    border-radius: 4px;
    transition: all $transition-duration;

    &:hover {
      transform: translateX(5px);
    }

    .todo-checkbox {
      margin-right: $spacing-md;
      cursor: pointer;
    }

    .todo-text {
      flex: 1;
    }

    .delete-btn {
      @include button-base;
      padding: $spacing-sm $spacing-md;
      background: $danger-color;

      &:hover {
        background: darken($danger-color, 5%);
      }
    }
  }
}

.completed {
  .todo-text {
    text-decoration: line-through;
    color: $text-muted;
  }
}

.todo-stats {
  margin-top: $spacing-lg;
  padding-top: $spacing-md;
  border-top: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  color: $text-muted;
}
</style> 