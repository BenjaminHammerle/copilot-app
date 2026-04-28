export interface Task {
  id: number;
  title: string;
  completed: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}
