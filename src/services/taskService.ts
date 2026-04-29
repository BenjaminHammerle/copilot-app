import AsyncStorage from "@react-native-async-storage/async-storage";
import { Task } from "../types/task";

const MOCK_API_URL = "https://jsonplaceholder.typicode.com/todos";
const TASK_LIMIT = 10;
const TASKS_CACHE_KEY = "TASKS_CACHE";
const NETWORK_TIMEOUT = 5000; // 5 seconds

export class TaskServiceError extends Error {
  constructor(
    public code:
      | "NETWORK_ERROR"
      | "VALIDATION_ERROR"
      | "CACHE_ERROR"
      | "API_ERROR"
      | "UNKNOWN_ERROR",
    message: string,
    public isOffline: boolean = false,
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export const checkNetworkAvailable = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

    const response = await fetch(
      "https://jsonplaceholder.typicode.com/todos/1",
      {
        method: "GET",
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    return response.ok || response.status === 200;
  } catch {
    return false;
  }
};

export const taskService = {
  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${MOCK_API_URL}?_limit=${TASK_LIMIT}`, {
        timeout: NETWORK_TIMEOUT,
      } as RequestInit & { timeout: number });

      if (!response.ok) {
        throw new TaskServiceError(
          "API_ERROR",
          "Failed to fetch tasks from server",
        );
      }

      const tasks: Task[] = await response.json();
      await saveTasksToCache(tasks);
      return tasks;
    } catch (error) {
      const cachedTasks = await loadTasksFromCache();
      if (cachedTasks.length > 0) {
        const err = new TaskServiceError(
          "NETWORK_ERROR",
          "Cannot connect to server. Showing cached tasks.",
          true,
        );
        err.isOffline = true;
        throw err;
      }

      if (error instanceof TaskServiceError) {
        throw error;
      }

      throw new TaskServiceError(
        "NETWORK_ERROR",
        "Cannot connect to server. Please check your internet connection.",
      );
    }
  },

  generateTaskId(existingTasks: Task[]): number {
    if (existingTasks.length === 0) {
      return 1;
    }
    return Math.max(...existingTasks.map((task) => task.id)) + 1;
  },

  createTask(title: string, existingTasks: Task[]): Task {
    if (!title || title.trim().length === 0) {
      throw new TaskServiceError(
        "VALIDATION_ERROR",
        "Task title cannot be empty",
      );
    }

    if (title.trim().length < 3) {
      throw new TaskServiceError(
        "VALIDATION_ERROR",
        "Task title must be at least 3 characters",
      );
    }

    return {
      id: this.generateTaskId(existingTasks),
      title: title.trim(),
      completed: false,
    };
  },

  async updateTask(id: number, title: string): Promise<void> {
    if (!title || title.trim().length === 0) {
      throw new TaskServiceError(
        "VALIDATION_ERROR",
        "Task title cannot be empty",
      );
    }

    if (title.trim().length < 3) {
      throw new TaskServiceError(
        "VALIDATION_ERROR",
        "Task title must be at least 3 characters",
      );
    }

    try {
      const response = await fetch(`${MOCK_API_URL}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title.trim() }),
        timeout: NETWORK_TIMEOUT,
      } as RequestInit & { timeout: number });

      if (!response.ok) {
        throw new TaskServiceError(
          "API_ERROR",
          "Failed to update task on server",
        );
      }
    } catch (error) {
      if (error instanceof TaskServiceError) {
        if (error.code === "VALIDATION_ERROR") {
          throw error;
        }
        throw new TaskServiceError(
          "NETWORK_ERROR",
          "Cannot connect to server. Task updated locally.",
          true,
        );
      }

      throw new TaskServiceError(
        "NETWORK_ERROR",
        "Cannot connect to server. Task updated locally.",
        true,
      );
    }
  },

  async deleteTask(id: number): Promise<void> {
    try {
      const response = await fetch(`${MOCK_API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: NETWORK_TIMEOUT,
      } as RequestInit & { timeout: number });

      if (!response.ok) {
        throw new TaskServiceError(
          "API_ERROR",
          "Failed to delete task on server",
        );
      }
    } catch (error) {
      if (error instanceof TaskServiceError) {
        throw new TaskServiceError(
          "NETWORK_ERROR",
          "Cannot connect to server. Task deleted locally.",
          true,
        );
      }

      throw new TaskServiceError(
        "NETWORK_ERROR",
        "Cannot connect to server. Task deleted locally.",
        true,
      );
    }
  },
};

export const saveTasksToCache = async (tasks: Task[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn("Warning: Failed to save tasks to cache");
    throw new TaskServiceError(
      "CACHE_ERROR",
      "Failed to save tasks locally. Changes may be lost.",
    );
  }
};

export const loadTasksFromCache = async (): Promise<Task[]> => {
  try {
    const data = await AsyncStorage.getItem(TASKS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn("Warning: Could not load cached tasks");
    return [];
  }
};

export const refreshTasksFromApi = async (): Promise<Task[]> => {
  try {
    const response = await fetch(`${MOCK_API_URL}?_limit=${TASK_LIMIT}`, {
      timeout: NETWORK_TIMEOUT,
    } as RequestInit & { timeout: number });

    if (!response.ok) {
      throw new TaskServiceError(
        "API_ERROR",
        "Failed to fetch tasks from server",
      );
    }

    const tasks: Task[] = await response.json();
    await saveTasksToCache(tasks);
    return tasks;
  } catch (error) {
    if (error instanceof TaskServiceError) {
      throw error;
    }

    throw new TaskServiceError(
      "NETWORK_ERROR",
      "Cannot connect to server. Please check your internet connection.",
    );
  }
};
