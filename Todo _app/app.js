// app.js
// Core architecture for ColorfulTodo
// Provides Task model and TaskStore for persisting tasks in localStorage.

// Key used for storing tasks in localStorage
const STORAGE_KEY = "colorfulTodoTasks";

/**
 * Task model representing a single todo item.
 */
class Task {
  /**
   * @param {string|number} id - Unique identifier for the task.
   * @param {string} text - The task description.
   * @param {boolean} [completed=false] - Completion status.
   */
  constructor(id, text, completed = false) {
    this.id = id;
    this.text = text;
    this.completed = completed;
  }

  /**
   * Toggle the completed status of the task.
   */
  toggleComplete() {
    this.completed = !this.completed;
  }

  /**
   * Serialize the task into a plain object suitable for JSON storage.
   * @returns {{id: (string|number), text: string, completed: boolean}}
   */
  serialize() {
    return {
      id: this.id,
      text: this.text,
      completed: this.completed,
    };
  }
}

/**
 * TaskStore handles loading, saving, and manipulating tasks in localStorage.
 */
const TaskStore = {
  /**
   * Load tasks from localStorage and return an array of Task instances.
   * @returns {Task[]}
   */
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map(item => new Task(item.id, item.text, item.completed));
    } catch (e) {
      console.error("Failed to parse tasks from localStorage:", e);
      return [];
    }
  },

  /**
   * Save an array of Task instances to localStorage.
   * @param {Task[]} tasks
   */
  save(tasks) {
    const serializable = tasks.map(task => task.serialize());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.error("Failed to save tasks to localStorage:", e);
    }
  },

  /**
   * Add a new task and persist the change.
   * @param {Task} task
   */
  add(task) {
    const tasks = this.load();
    tasks.push(task);
    this.save(tasks);
  },

  /**
   * Update an existing task (matched by id) and persist.
   * @param {Task} task
   */
  update(task) {
    const tasks = this.load();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      tasks[index] = task;
      this.save(tasks);
    } else {
      console.warn(`Task with id ${task.id} not found for update.`);
    }
  },

  /**
   * Delete a task by its id and persist.
   * @param {string|number} id
   */
  delete(id) {
    const tasks = this.load();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length !== tasks.length) {
      this.save(filtered);
    } else {
      console.warn(`Task with id ${id} not found for deletion.`);
    }
  },

  /**
   * Reorder tasks within the list and persist.
   * @param {number} oldIndex - Current index of the task.
   * @param {number} newIndex - Desired index after moving.
   */
  reorder(oldIndex, newIndex) {
    const tasks = this.load();
    if (oldIndex < 0 || oldIndex >= tasks.length || newIndex < 0 || newIndex >= tasks.length) {
      console.warn('Invalid reorder indices:', oldIndex, newIndex);
      return;
    }
    const [moved] = tasks.splice(oldIndex, 1);
    tasks.splice(newIndex, 0, moved);
    this.save(tasks);
  },
};

// Expose TaskStore globally for other modules to use.
window.TaskStore = TaskStore;

// Also expose Task class and STORAGE_KEY if needed elsewhere.
window.Task = Task;
window.STORAGE_KEY = STORAGE_KEY;

/* ---------------------------------------------------------------
 * UI Rendering and State Synchronization
 * --------------------------------------------------------------- */

// Global in‑memory copy of tasks – kept in sync with TaskStore.
let tasks = TaskStore.load();

// Keep track of the current filter and search term for re‑rendering.
let currentFilter = "all";
let currentSearch = "";

/**
 * Render the task list according to the provided filter and search term.
 *
 * @param {string} [filter="all"] - "all", "active" or "completed".
 * @param {string} [searchTerm=""] - Case‑insensitive substring to match task text.
 */
function renderTasks(filter = currentFilter, searchTerm = currentSearch) {
  // Update the globals so subsequent UI actions keep the same view.
  currentFilter = filter;
  currentSearch = searchTerm;

  const listEl = document.getElementById("task-list");
  if (!listEl) {
    console.error("#task-list element not found in the DOM.");
    return;
  }

  // Clear existing list.
  listEl.innerHTML = "";

  // Apply filtering.
  const filtered = tasks.filter(task => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && !task.completed) ||
      (filter === "completed" && task.completed);
    const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Render each task.
  filtered.forEach(task => {
    const li = document.createElement("li");
    li.dataset.id = task.id;
    if (task.completed) li.classList.add("completed");

    // Build inner HTML – using semantic elements and CSS classes.
    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} />
      <span class="task-text">${task.text}</span>
      <button class="edit-btn" title="Edit">✏️</button>
      <button class="delete-btn" title="Delete">🗑️</button>
    `;

    listEl.appendChild(li);
  });
}

/**
 * Delegated event handling for task interactions (checkbox, edit, delete).
 */
function attachTaskListListeners() {
  const listEl = document.getElementById("task-list");
  if (!listEl) return;

  listEl.addEventListener("click", event => {
    const li = event.target.closest("li");
    if (!li) return;
    const id = li.dataset.id;
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;

    // Checkbox toggle – the click may land on the input itself.
    if (event.target.matches('input[type="checkbox"].task-checkbox')) {
      task.toggleComplete();
      TaskStore.update(task);
      renderTasks();
      return;
    }

    // Edit button.
    if (event.target.matches('.edit-btn')) {
      const newText = prompt('Edit task', task.text);
      if (newText !== null) {
        const trimmed = newText.trim();
        if (trimmed) {
          task.text = trimmed;
          TaskStore.update(task);
          renderTasks();
        }
      }
      return;
    }

    // Delete button.
    if (event.target.matches('.delete-btn')) {
      TaskStore.delete(task.id);
      // Refresh the in‑memory copy.
      tasks = TaskStore.load();
      renderTasks();
      return;
    }
  });
}

// Initial render and listener attachment.
renderTasks();
attachTaskListListeners();

// Export render function for external modules (e.g., filter UI).
window.renderTasks = renderTasks;
