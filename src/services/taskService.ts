import AsyncStorage from "@react-native-async-storage/async-storage";
import { Task } from "../types/task";

const MOCK_API_URL = "https://jsonplaceholder.typicode.com/todos";
const TASK_LIMIT = 10;
const TASKS_CACHE_KEY = "TASKS_CACHE";

export const taskService = {
  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${MOCK_API_URL}?_limit=${TASK_LIMIT}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tasks: Task[] = await response.json();
      await saveTasksToCache(tasks);
      return tasks;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return await loadTasksFromCache();
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

  async updateTask(id: number, title: string): Promise<void> {
    try {
      const response = await fetch(`${MOCK_API_URL}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`Task ${id} updated successfully`);
    } catch (error) {
      console.error(`Error updating task ${id}:`, error);
      throw error;
    }
  },

  async deleteTask(id: number): Promise<void> {
    try {
      const response = await fetch(`${MOCK_API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`Task ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting task ${id}:`, error);
      throw error;
    }
  },
};

export const saveTasksToCache = async (tasks: Task[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Error saving tasks to cache", error);
  }
};

export const loadTasksFromCache = async (): Promise<Task[]> => {
  try {
    const data = await AsyncStorage.getItem(TASKS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading tasks from cache", error);
    return [];
  }
};

export const refreshTasksFromApi = async (): Promise<Task[]> => {
  try {
    const response = await fetch(`${MOCK_API_URL}?_limit=${TASK_LIMIT}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const tasks: Task[] = await response.json();
    await saveTasksToCache(tasks);
    return tasks;
  } catch (error) {
    console.error("Error refreshing tasks from API:", error);
    throw error;
  }
};
