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
import {
  loadTasksFromCache,
  refreshTasksFromApi,
  saveTasksToCache,
  taskService,
  TaskServiceError,
} from "../services/taskService";
import { Task } from "../types/task";

type FilterType = "all" | "open" | "completed";
type SortType = "title-asc" | "title-desc";

interface HomeScreenProps {
  onLogout: () => void;
}

interface EditState {
  taskId: number | null;
  editTitle: string;
  editError: string;
  isLoading: boolean;
}

interface FeedbackMessage {
  message: string;
  type: "success" | "error";
  taskId?: number;
}

interface OperationLoading {
  taskId?: number;
  operation: "create" | "update" | "delete" | null;
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
    isLoading: false,
  });
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("title-asc");
  const [operationLoading, setOperationLoading] = useState<OperationLoading>({
    taskId: undefined,
    operation: null,
  });
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (feedback) {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
      }, 2500);
    }
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [feedback]);

  const showFeedback = (
    message: string,
    type: "success" | "error",
    taskId?: number,
  ) => {
    setFeedback({ message, type, taskId });
  };

  const fetchTasks = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      setIsOffline(false);

      // Load from cache first - cache is the source of truth
      const cachedTasks = await loadTasksFromCache();

      if (cachedTasks.length > 0) {
        // Cache has tasks - use them
        setTasks(cachedTasks);
        setLoading(false);
        return;
      }

      // Cache is empty - fetch from API on first load
      const freshTasks = await refreshTasksFromApi();
      setTasks(freshTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);

      if (err instanceof TaskServiceError && err.isOffline) {
        setIsOffline(true);
        // Try to load from cache as fallback
        const cachedTasks = await loadTasksFromCache();
        setTasks(cachedTasks);
        setError("");
      } else {
        setError("Failed to load tasks. Please try again.");
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndSortedTasks = (): Task[] => {
    let filtered: Task[] = tasks;
    if (filterType === "open") {
      filtered = tasks.filter((task) => !task.completed);
    } else if (filterType === "completed") {
      filtered = tasks.filter((task) => task.completed);
    }

    const sorted = [...filtered];
    if (sortType === "title-asc") {
      sorted.sort((a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
      );
    } else if (sortType === "title-desc") {
      sorted.sort((a, b) =>
        b.title.toLowerCase().localeCompare(a.title.toLowerCase()),
      );
    }

    return sorted;
  };

  const validateTaskTitle = (title: string): string | null => {
    if (!title || title.trim().length === 0) {
      return "Task title is required";
    }
    if (title.trim().length < 3) {
      return "Task title must be at least 3 characters";
    }
    return null;
  };

  const handleAddTask = async (): Promise<void> => {
    setValidationError("");

    const validationError = validateTaskTitle(taskTitle);
    if (validationError) {
      setValidationError(validationError);
      return;
    }

    setIsCreating(true);
    try {
      // Validate in service layer as well
      const newTask = taskService.createTask(taskTitle.trim(), tasks);
      const updatedTasks = [newTask, ...tasks];

      setTasks(updatedTasks);
      await saveTasksToCache(updatedTasks);
      setTaskTitle("");

      showFeedback("Task created successfully!", "success");

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    } catch (err) {
      console.error("Error creating task:", err);

      if (err instanceof TaskServiceError) {
        setValidationError(err.message);
      } else {
        setValidationError("Failed to create task. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditStart = (task: Task): void => {
    setEditState({
      taskId: task.id,
      editTitle: task.title,
      editError: "",
      isLoading: false,
    });
  };

  const handleEditCancel = (): void => {
    setEditState({
      taskId: null,
      editTitle: "",
      editError: "",
      isLoading: false,
    });
  };

  const handleEditSave = async (taskId: number): Promise<void> => {
    const validationError = validateTaskTitle(editState.editTitle);
    if (validationError) {
      setEditState((prev) => ({
        ...prev,
        editError: validationError,
      }));
      return;
    }

    setEditState((prev) => ({ ...prev, isLoading: true }));
    try {
      // Call API to update on server
      await taskService.updateTask(taskId, editState.editTitle.trim());
    } catch (err) {
      console.error("Error updating task on API:", err);

      // If it's an offline error, that's ok - we'll update locally
      if (err instanceof TaskServiceError && err.isOffline) {
        // Continue with local update
      } else if (
        err instanceof TaskServiceError &&
        err.code === "VALIDATION_ERROR"
      ) {
        setEditState((prev) => ({
          ...prev,
          editError: err.message,
          isLoading: false,
        }));
        return;
      } else {
        setEditState((prev) => ({
          ...prev,
          editError: "Failed to update task. Please try again.",
          isLoading: false,
        }));
        return;
      }
    }

    // Update local state
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, title: editState.editTitle.trim() }
          : task,
      );
      saveTasksToCache(updatedTasks);
      return updatedTasks;
    });

    showFeedback("Task updated successfully!", "success");
    setEditState({
      taskId: null,
      editTitle: "",
      editError: "",
      isLoading: false,
    });
  };

  const handleDeleteTask = async (taskId: number): Promise<void> => {
    setOperationLoading({ taskId, operation: "delete" });
    try {
      // Call API to delete on server
      await taskService.deleteTask(taskId);
    } catch (err) {
      console.error("Error deleting task on API:", err);

      // If it's an offline error, that's ok - we'll delete locally
      if (!(err instanceof TaskServiceError && err.isOffline)) {
        if (err instanceof TaskServiceError) {
          showFeedback(err.message, "error");
        } else {
          showFeedback("Failed to delete task. Please try again.", "error");
        }
        setOperationLoading({ taskId: undefined, operation: null });
        return;
      }
    }

    // Update local state
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.filter((task) => task.id !== taskId);
      saveTasksToCache(updatedTasks);
      return updatedTasks;
    });

    showFeedback("Task deleted successfully!", "success");
    setOperationLoading({ taskId: undefined, operation: null });
  };

  const handleToggleComplete = async (task: Task): Promise<void> => {
    setOperationLoading({ taskId: task.id, operation: "update" });
    try {
      const newTitle = task.title;
      await taskService.updateTask(task.id, newTitle);
    } catch (err) {
      console.error("Error toggling task status:", err);
      // If offline, still allow local toggle
      if (!(err instanceof TaskServiceError && err.isOffline)) {
        showFeedback("Failed to update task status", "error");
        setOperationLoading({ taskId: undefined, operation: null });
        return;
      }
    }

    // Update local state
    setTasks((prevTasks) => {
      const updatedTasks = prevTasks.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t,
      );
      saveTasksToCache(updatedTasks);
      return updatedTasks;
    });

    setOperationLoading({ taskId: undefined, operation: null });
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.removeToken();
      onLogout();
    } catch (error) {
      console.error("Error during logout:", error);
      showFeedback("Error during logout", "error");
    }
  };

  const renderTaskItem = ({ item }: { item: Task }): React.ReactElement => {
    const isEditing = editState.taskId === item.id;
    const isDeleting =
      operationLoading.operation === "delete" &&
      operationLoading.taskId === item.id;
    const isToggling =
      operationLoading.operation === "update" &&
      operationLoading.taskId === item.id;

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
              editable={!editState.isLoading}
            />
            {editState.editError ? (
              <Text style={styles.editError}>{editState.editError}</Text>
            ) : null}
            <View style={styles.editButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  editState.isLoading && styles.buttonDisabled,
                ]}
                onPress={() => handleEditSave(item.id)}
                disabled={editState.isLoading}
              >
                {editState.isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleEditCancel}
                disabled={editState.isLoading}
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
        <View
          style={[styles.taskContent, isDeleting && styles.taskItemDeleting]}
        >
          <TouchableOpacity
            style={styles.taskCheckbox}
            onPress={() => handleToggleComplete(item)}
            disabled={isToggling}
          >
            <View
              style={[
                styles.checkbox,
                item.completed && styles.checkboxChecked,
              ]}
            >
              {item.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          <View style={styles.taskInfo}>
            <Text
              style={[
                styles.taskTitle,
                item.completed && styles.taskTitleCompleted,
              ]}
            >
              {item.title}
            </Text>
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
              style={[
                styles.editButton,
                editState.isLoading && styles.buttonDisabled,
              ]}
              onPress={() => handleEditStart(item)}
              disabled={isDeleting || isToggling}
            >
              <Text style={styles.editButtonLabel}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
              onPress={() => handleDeleteTask(item.id)}
              disabled={isDeleting || isToggling}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.deleteButtonLabel}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const displayedTasks = getFilteredAndSortedTasks();

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

        {isOffline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              📡 Offline mode – showing cached tasks
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderText}>Loading tasks...</Text>
          </View>
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
                  style={[styles.input, isCreating && styles.inputDisabled]}
                  placeholder="Enter task title"
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholderTextColor="#999"
                  editable={!isCreating}
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    isCreating && styles.buttonDisabled,
                  ]}
                  onPress={handleAddTask}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.addButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
              {validationError ? (
                <Text style={styles.validationError}>{validationError}</Text>
              ) : null}
            </View>

            {/* FILTER AND SORT CONTROLS */}
            <View style={styles.controlsContainer}>
              <View style={styles.filterSection}>
                <Text style={styles.controlLabel}>Filter:</Text>
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === "all" && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterType("all")}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        filterType === "all" && styles.filterButtonTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === "open" && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterType("open")}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        filterType === "open" && styles.filterButtonTextActive,
                      ]}
                    >
                      Open
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      filterType === "completed" && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterType("completed")}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        filterType === "completed" &&
                          styles.filterButtonTextActive,
                      ]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sortSection}>
                <Text style={styles.controlLabel}>Sort:</Text>
                <View style={styles.sortButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortType === "title-asc" && styles.sortButtonActive,
                    ]}
                    onPress={() => setSortType("title-asc")}
                  >
                    <Text
                      style={[
                        styles.sortButtonText,
                        sortType === "title-asc" && styles.sortButtonTextActive,
                      ]}
                    >
                      A-Z
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortButton,
                      sortType === "title-desc" && styles.sortButtonActive,
                    ]}
                    onPress={() => setSortType("title-desc")}
                  >
                    <Text
                      style={[
                        styles.sortButtonText,
                        sortType === "title-desc" &&
                          styles.sortButtonTextActive,
                      ]}
                    >
                      Z-A
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>
                Tasks ({displayedTasks.length})
              </Text>
              <FlatList
                data={displayedTasks}
                renderItem={renderTaskItem}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No tasks to display</Text>
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  feedbackContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedbackSuccess: {
    backgroundColor: "#d4edda",
    borderColor: "#28a745",
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: "#f8d7da",
    borderColor: "#dc3545",
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  offlineIndicator: {
    backgroundColor: "#fff3cd",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderColor: "#ffc107",
    borderWidth: 1,
  },
  offlineText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#856404",
  },
  errorContainer: {
    backgroundColor: "#f8d7da",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    marginVertical: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#721c24",
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  contentContainer: {
    marginBottom: 20,
  },
  formContainer: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 8,
    color: "#333",
  },
  inputDisabled: {
    opacity: 0.6,
  },
  addButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  validationError: {
    fontSize: 12,
    color: "#dc3545",
    marginTop: 8,
  },
  controlsContainer: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  filterSection: {
    marginBottom: 12,
  },
  filterButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
  },
  filterButtonTextActive: {
    color: "#FFF",
  },
  sortSection: {},
  sortButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  sortButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
  },
  sortButtonTextActive: {
    color: "#FFF",
  },
  listContainer: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  taskItem: {
    backgroundColor: "#FFF",
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskItemDeleting: {
    opacity: 0.6,
  },
  taskContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  taskCheckbox: {
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  checkboxChecked: {
    backgroundColor: "#28a745",
    borderColor: "#28a745",
  },
  checkmark: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#999",
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusOpen: {
    color: "#ff9800",
  },
  statusDone: {
    color: "#28a745",
  },
  taskActionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonLabel: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonLabel: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  editContainer: {
    padding: 12,
  },
  editInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  editError: {
    fontSize: 12,
    color: "#dc3545",
    marginBottom: 8,
  },
  editButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#28a745",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#6c757d",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  logoutButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#dc3545",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
