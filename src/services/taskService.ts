import { Task } from "../types/task";

const MOCK_API_URL = "https://jsonplaceholder.typicode.com/todos";
const TASK_LIMIT = 10;

export const taskService = {
  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${MOCK_API_URL}?_limit=${TASK_LIMIT}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tasks: Task[] = await response.json();
      return tasks;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  },

  generateTaskId(existingTasks: Task[]): number {
    if (existingTasks.length === 0) {
      return 1;
    }
    return Math.max(...existingTasks.map((task) => task.id)) + 1;
  },

  createTask(title: string, existingTasks: Task[]): Task {
    return {
      id: this.generateTaskId(existingTasks),
      title,
      completed: false,
    };
  },
};
