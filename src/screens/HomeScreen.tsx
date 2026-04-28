import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { authService } from "../services/authService";
import { taskService } from "../services/taskService";
import { Task, ValidationError } from "../types/task";

interface HomeScreenProps {
  onLogout: () => void;
}

interface EditState {
  taskId: number | null;
  editTitle: string;
  editError: string;
}

interface FeedbackMessage {
  message: string;
  type: "success" | "error";
  taskId?: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const [editState, setEditState] = useState<EditState>({
    taskId: null,
    editTitle: "",
    editError: "",
  });
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fetchTasks = async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const fetchedTasks = await taskService.getTasks();
      setTasks(fetchedTasks);
    } catch (err) {
      setError("Failed to load tasks");
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateTaskTitle = (title: string): ValidationError | null => {
    if (!title || title.trim().length === 0) {
      return { field: "title", message: "Task title is required" };
    }
    if (title.trim().length < 3) {
      return {
        field: "title",
        message: "Task title must be at least 3 characters",
      };
    }
    return null;
  };

  const handleAddTask = (): void => {
    setValidationError("");

    const validationResult = validateTaskTitle(taskTitle);
    if (validationResult) {
      setValidationError(validationResult.message);
      return;
    }

    const newTask = taskService.createTask(taskTitle.trim(), tasks);
    setTasks([newTask, ...tasks]);
    setTaskTitle("");

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleEditStart = (task: Task): void => {
    setEditState({
      taskId: task.id,
      editTitle: task.title,
      editError: "",
    });
  };

  const handleEditCancel = (): void => {
    setEditState({ taskId: null, editTitle: "", editError: "" });
  };

  const handleEditSave = async (taskId: number): Promise<void> => {
    const validationResult = validateTaskTitle(editState.editTitle);
    if (validationResult) {
      setEditState((prev) => ({
        ...prev,
        editError: validationResult.message,
      }));
      return;
    }

    try {
      await taskService.updateTask(taskId, editState.editTitle.trim());

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? { ...task, title: editState.editTitle.trim() }
            : task,
        ),
      );

      setEditState({ taskId: null, editTitle: "", editError: "" });
    } catch (err) {
      console.error("Error updating task:", err);
      setEditState((prev) => ({
        ...prev,
        editError: "Failed to update task",
      }));
    }
  };

  const handleDeleteTask = async (taskId: number): Promise<void> => {
    try {
      await taskService.deleteTask(taskId);

      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));

      setFeedback({
        message: "Task deleted successfully",
        type: "success",
        taskId,
      });
    } catch (err) {
      console.error("Error deleting task:", err);
      setFeedback({
        message: "Failed to delete task",
        type: "error",
        taskId,
      });
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.removeToken();
      onLogout();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const renderTaskItem = ({ item }: { item: Task }): React.ReactElement => {
    const isEditing = editState.taskId === item.id;

    if (isEditing) {
      return (
        <View style={styles.taskItem}>
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editState.editTitle}
              onChangeText={(text) =>
                setEditState((prev) => ({ ...prev, editTitle: text }))
              }
              placeholder="Edit task title"
              placeholderTextColor="#999"
              autoFocus
            />
            {editState.editError ? (
              <Text style={styles.editError}>{editState.editError}</Text>
            ) : null}
            <View style={styles.editButtonsContainer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleEditSave(item.id)}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleEditCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.taskItem}>
        <View style={styles.taskContent}>
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text
              style={[
                styles.taskStatus,
                item.completed ? styles.statusDone : styles.statusOpen,
              ]}
            >
              {item.completed ? "Done" : "Open"}
            </Text>
          </View>
          <View style={styles.taskActionButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditStart(item)}
            >
              <Text style={styles.editButtonLabel}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteTask(item.id)}
            >
              <Text style={styles.deleteButtonLabel}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Logged in successfully</Text>

        {feedback ? (
          <View
            style={[
              styles.feedbackContainer,
              feedback.type === "success"
                ? styles.feedbackSuccess
                : styles.feedbackError,
            ]}
          >
            <Text style={styles.feedbackText}>{feedback.message}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTasks}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Add New Task</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter task title"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddTask}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {validationError ? (
                <Text style={styles.validationError}>{validationError}</Text>
              ) : null}
            </View>

            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Tasks ({tasks.length})</Text>
              <FlatList
                data={tasks}
                renderItem={renderTaskItem}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No tasks yet</Text>
                }
              />
            </View>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  contentContainer: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    minHeight: 200,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  feedbackContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 15,
    alignItems: "center",
  },
  feedbackSuccess: {
    backgroundColor: "#34C75933",
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
  },
  feedbackError: {
    backgroundColor: "#FF3B3033",
    borderLeftWidth: 4,
    borderLeftColor: "#FF3B30",
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#34C759",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#34C759",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  validationError: {
    color: "#FF3B30",
    fontSize: 12,
  },
  listContainer: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  taskItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  taskContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskInfo: {
    flex: 1,
    marginRight: 10,
  },
  taskTitle: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusDone: {
    backgroundColor: "#34C759",
    color: "#fff",
  },
  statusOpen: {
    backgroundColor: "#FF9500",
    color: "#fff",
  },
  taskActionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  editContainer: {
    width: "100%",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  editError: {
    color: "#FF3B30",
    fontSize: 12,
    marginBottom: 8,
  },
  editButtonsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#34C759",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginTop: 20,
  },
  logoutButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
