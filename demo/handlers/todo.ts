/**
 * TodoList handler: manages a list of todos
 */
export interface TodoItem { id: string; title: string; completed: boolean }
export interface TodoListState { id: string; items: TodoItem[] }

export const TodoListHandler = {
  async mount({ todoListId }: { todoListId?: string } = {}): Promise<TodoListState> {
    const id = todoListId || "my-list";
    return {
      id,
      items: [
        { id: "1", title: "Learn Nasc", completed: true },
        { id: "2", title: "Build an app", completed: false },
      ],
    };
  },

  async add_todo(payload: any, current: TodoListState): Promise<TodoListState> {
    const next: TodoListState = { ...current };
    const newTodo: TodoItem = {
      id: `${Date.now()}`,
      title: payload?.title || "New Todo",
      completed: false,
    };
    next.items = [...next.items, newTodo];
    return next;
  },

  async toggle_todo(payload: any, current: TodoListState): Promise<TodoListState> {
    const next: TodoListState = { ...current };
    next.items = next.items.map((item) => {
      if (item.id === payload?.id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });
    return next;
  },

  async move_up(payload: any, current: TodoListState): Promise<TodoListState> {
    const id = String(payload?.id || "");
    const idx = current.items.findIndex((i) => i.id === id);
    if (idx <= 0) return current;
    const items = current.items.slice();
    const [it] = items.splice(idx, 1);
    items.splice(idx - 1, 0, it);
    return { ...current, items };
  },

  async move_down(payload: any, current: TodoListState): Promise<TodoListState> {
    const id = String(payload?.id || "");
    const idx = current.items.findIndex((i) => i.id === id);
    if (idx < 0 || idx >= current.items.length - 1) return current;
    const items = current.items.slice();
    const [it] = items.splice(idx, 1);
    items.splice(idx + 1, 0, it);
    return { ...current, items };
  },

  async remove_todo(payload: any, current: TodoListState): Promise<TodoListState> {
    const id = String(payload?.id || "");
    const items = current.items.filter((i) => i.id !== id);
    return { ...current, items };
  }
};
