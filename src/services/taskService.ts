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
};
