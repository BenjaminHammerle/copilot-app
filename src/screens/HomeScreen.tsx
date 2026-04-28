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

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

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

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.removeToken();
      onLogout();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const renderTaskItem = ({ item }: { item: Task }): React.ReactElement => (
    <View style={styles.taskItem}>
      <View style={styles.taskContent}>
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
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Logged in successfully</Text>

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
  taskTitle: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  taskStatus: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusDone: {
    backgroundColor: "#34C759",
    color: "#fff",
  },
  statusOpen: {
    backgroundColor: "#FF9500",
    color: "#fff",
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
