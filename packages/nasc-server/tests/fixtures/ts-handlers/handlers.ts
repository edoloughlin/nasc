export interface User { id: string; name: string; email?: string }
export interface Todo { id: string; title: string; completed: boolean }
export interface TodoList { id: string; items: Todo[] }

export const UserHandler = {
  async mount(): Promise<User> { return { id: 'u', name: 'User', email: '' }; }
};

export const TodoListHandler = {
  async mount(): Promise<TodoList> { return { id: 't', items: [] }; }
};

