# -*- coding: utf-8 -*- # 파일 인코딩 명시 (한글 주석/문자열 처리)

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import re
import shutil

class SkillEditorApp:
    def __init__(self, master):
        self.master = master
        master.title("Manual Skill Stats Editor")

        # --- Configuration ---
        self.json_path = 'data/er/manual_skill_stats.json'

        # --- Data Storage ---
        self.data = {}
        self.filtered_skills = {}
        self.current_skill_key = None
        self.current_skill_id = None

        # --- GUI Layout ---
        self.create_widgets()
        self.load_data()

        # --- Text Widget Tags ---
        # Define tags for highlighting in tk.Text widgets
        self.l10n_coef_text_widget.tag_config('orange_ph', foreground='blue')
        self.l10n_coef_text_widget.tag_config('red_ph', foreground='red')
        self.l10n_desc_text_widget.tag_config('orange_ph', foreground='blue')
        self.l10n_desc_text_widget.tag_config('red_ph', foreground='red')


    def load_data(self):
        """Loads data from the specified JSON file."""
        if not os.path.exists(self.json_path):
            messagebox.showerror("Error", f"File not found: {self.json_path}")
            if hasattr(self, 'status_label'):
                 self.status_label.config(text="Error: File not found")
            return

        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)

            if not isinstance(self.data, dict) or not all(isinstance(k, str) and isinstance(v, dict) for k, v in list(self.data.items())[:5]):
                 print("Warning: Loaded JSON structure does not match expected {skill_id: skill_data_dict} format.")
                 if hasattr(self, 'status_label'):
                      self.status_label.config(text="Warning: Unexpected JSON structure")

            if hasattr(self, 'status_label'):
                 self.status_label.config(text=f"Successfully loaded {self.json_path}")
        except json.JSONDecodeError:
            messagebox.showerror("Error", f"Invalid JSON in {self.json_path}")
            if hasattr(self, 'status_label'):
                 self.status_label.config(text="Error: Invalid JSON")
            self.data = {}
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file: {e}")
            if hasattr(self, 'status_label'):
                 self.status_label.config(text=f"Error: {e}")
            self.data = {}


    def _on_mousewheel(self, event):
        """Handles mousewheel scrolling for canvases."""
        canvas = None
        widget_under_mouse = event.widget
        while widget_under_mouse:
            if isinstance(widget_under_mouse, tk.Canvas):
                canvas = widget_under_mouse
                break
            widget_under_mouse = widget_under_mouse.winfo_parent()

        if canvas and self.master.winfo_exists():
            if event.num == 5 or event.delta < 0: # Scroll down
                canvas.yview_scroll(1, "units")
            elif event.num == 4 or event.delta > 0: # Scroll up
                canvas.yview_scroll(-1, "units")

    # PART 2/7: GUI Creation (New Layout) and Skill Filtering
    # create_widgets method

    def create_widgets(self):
        # Configure the main window's grid to have two main columns for content
        self.master.columnconfigure(0, weight=50) # Left column (Info) - Adjusted weight (e.g. 3)
        self.master.columnconfigure(1, weight=2) # Right column (Editable) - Adjusted weight (e.g. 2)

        self.master.rowconfigure(0, weight=0)
        self.master.rowconfigure(1, weight=0)
        self.master.rowconfigure(2, weight=0)
        self.master.rowconfigure(3, weight=1) # Main content area takes vertical space
        self.master.rowconfigure(4, weight=0)
        self.master.rowconfigure(5, weight=0)

        file_frame = ttk.Frame(self.master, padding="10")
        file_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E))
        ttk.Label(file_frame, text="JSON File Path:").grid(row=0, column=0, sticky=tk.W)
        self.file_path_label = ttk.Label(file_frame, text=self.json_path)
        self.file_path_label.grid(row=0, column=1, sticky=(tk.W, tk.E))
        file_frame.columnconfigure(1, weight=1)

        filter_frame = ttk.Frame(self.master, padding="10")
        filter_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E))
        ttk.Label(filter_frame, text="Character Code:").grid(row=0, column=0, sticky=tk.W)
        self.char_code_entry = ttk.Entry(filter_frame, width=10)
        self.char_code_entry.grid(row=0, column=1, sticky=(tk.W))
        self.char_code_entry.bind('<Return>', lambda event=None: self.filter_skills())
        ttk.Button(filter_frame, text="Filter", command=self.filter_skills).grid(row=0, column=2, sticky=tk.W)

        skill_select_frame = ttk.Frame(self.master, padding="10")
        skill_select_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E))
        ttk.Label(skill_select_frame, text="Select Skill:").grid(row=0, column=0, sticky=tk.W)
        self.skill_key_combobox = ttk.Combobox(skill_select_frame, state="readonly", width=5)
        self.skill_key_combobox.grid(row=0, column=1, sticky=(tk.W))
        self.skill_key_combobox.bind("<<ComboboxSelected>>", self.select_skill)

        # --- Main Content Area (Split into Left and Right) ---

        # Left Column: Skill Information (Read-only)
        info_frame = ttk.LabelFrame(self.master, text="Skill Information (Read-only)", padding="10")
        info_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        info_frame.columnconfigure(0, weight=0) # Label column weight (fixed)
        info_frame.columnconfigure(1, weight=1) # Content column weight (expandable)


        self.info_canvas = tk.Canvas(info_frame)
        self.info_scrollbar = ttk.Scrollbar(info_frame, orient="vertical", command=self.info_canvas.yview)
        self.info_canvas.configure(yscrollcommand=self.info_scrollbar.set)

        self.info_scrollbar.pack(side="right", fill="y")
        self.info_canvas.pack(side="left", fill="both", expand=True) # Canvas takes available space in info_frame

        self.info_inner_frame = ttk.Frame(self.info_canvas)
        self.info_canvas.create_window((0, 0), window=self.info_inner_frame, anchor="nw")

        self.info_inner_frame.bind("<Configure>", lambda e: self.info_canvas.configure(scrollregion=self.info_canvas.bbox("all")))
        self.info_inner_frame.bind_all("<MouseWheel>", self._on_mousewheel)

        # Inner frame needs columns configured too
        self.info_inner_frame.columnconfigure(0, weight=0) # Label column
        self.info_inner_frame.columnconfigure(1, weight=1) # Text/Label column


        # Use tk.Text for l10nCoefText and l10nDescText to support highlighting
        text_widget_height = 10 # Adjust height as needed (lines)
        # No need to set width explicitly if column has weight and wrap='word' is used
        # text_widget_width = 70

        ttk.Label(self.info_inner_frame, text="skillName:").grid(row=0, column=0, sticky=tk.W)
        # wraplength should ideally be based on the allocated width of column 1 in the inner frame
        # but a fixed value is often easier and okay if the window is resizable.
        self.skill_name_label = ttk.Label(self.info_inner_frame, text="", wraplength=550, justify="left")
        self.skill_name_label.grid(row=0, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nCoefText:").grid(row=1, column=0, sticky=tk.W)
        # Modified to use tk.Text
        self.l10n_coef_text_widget = tk.Text(self.info_inner_frame, wrap='word', height=text_widget_height, state='disabled') # Removed explicit width
        self.l10n_coef_text_widget.grid(row=1, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nDescText:").grid(row=2, column=0, sticky=tk.W)
        # Modified to use tk.Text
        self.l10n_desc_text_widget = tk.Text(self.info_inner_frame, wrap='word', height=text_widget_height, state='disabled') # Removed explicit width
        self.l10n_desc_text_widget.grid(row=2, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nLobbyDescText:").grid(row=3, column=0, sticky=tk.W)
        self.l10n_lobby_desc_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=550, justify="left")
        self.l10n_lobby_desc_text_label.grid(row=3, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nExpansionTipText:").grid(row=4, column=0, sticky=tk.W)
        self.l10n_expansion_tip_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=550, justify="left")
        self.l10n_expansion_tip_text_label.grid(row=4, column=1, sticky=(tk.W, tk.E))


        # Right Column: Editable Placeholder Values
        self.editable_frame = ttk.LabelFrame(self.master, text="Editable Placeholder Values", padding="10")
        self.editable_frame.grid(row=3, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.editable_frame.columnconfigure(1, weight=0) # Entry columns should expand
        self.editable_frame.columnconfigure(2, weight=0) # Adjusted weight for potential third column (if used)
        self.editable_frame.columnconfigure(3, weight=0) # Scrollbar column weight


        row_idx = 0
        ttk.Label(self.editable_frame, text="cooldown:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cooldown_entry = ttk.Entry(self.editable_frame, width=30)
        self.cooldown_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E)) # Span 2 columns
        row_idx += 1

        ttk.Label(self.editable_frame, text="costType:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cost_type_entry = ttk.Entry(self.editable_frame, width=20)
        self.cost_type_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W)) # Span 2 columns
        row_idx += 1

        ttk.Label(self.editable_frame, text="cost:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cost_entry = ttk.Entry(self.editable_frame, width=30)
        self.cost_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E)) # Span 2 columns
        row_idx += 1

        ttk.Label(self.editable_frame, text="range:").grid(row=row_idx, column=0, sticky=tk.W)
        self.range_entry = ttk.Entry(self.editable_frame, width=30)
        self.range_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E)) # Span 2 columns
        row_idx += 1

        ttk.Separator(self.editable_frame, orient='horizontal').grid(row=row_idx, column=0, columnspan=4, sticky=(tk.W, tk.E), pady=5) # Spans 4 columns
        row_idx += 1

        ttk.Label(self.editable_frame, text="Coef Values (placeholder.coef):").grid(row=row_idx, column=0, columnspan=2, sticky=tk.W)
        row_idx += 1

        self.coef_placeholder_canvas = tk.Canvas(self.editable_frame, borderwidth=0)
        self.coef_placeholder_scrollbar = ttk.Scrollbar(self.editable_frame, orient="vertical", command=self.coef_placeholder_canvas.yview)
        self.coef_placeholder_canvas.configure(yscrollcommand=self.coef_placeholder_scrollbar.set)

        self.coef_placeholder_scrollbar.grid(row=row_idx, column=3, sticky=(tk.N, tk.S, tk.E))
        self.coef_placeholder_canvas.grid(row=row_idx, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S)) # Canvas spans 3 columns
        self.editable_frame.rowconfigure(row_idx, weight=1) # This row expands vertically

        self.coef_placeholder_inner_frame = ttk.Frame(self.coef_placeholder_canvas)
        self.coef_placeholder_canvas.create_window((0, 0), window=self.coef_placeholder_inner_frame, anchor="nw")
        self.coef_placeholder_inner_frame.bind("<Configure>", lambda e: self.coef_placeholder_canvas.configure(scrollregion=self.coef_placeholder_canvas.bbox("all")))
        self.coef_placeholder_inner_frame.bind_all("<MouseWheel>", self._on_mousewheel)
        # Inner frame columns for dynamic entries
        self.coef_placeholder_inner_frame.columnconfigure(0, weight=0) # {i}: Label
        self.coef_placeholder_inner_frame.columnconfigure(1, weight=1) # Value Entry (takes remaining width)

        row_idx += 1

        ttk.Label(self.editable_frame, text="Desc Values (placeholder.desc):").grid(row=row_idx, column=0, columnspan=2, sticky=tk.W)
        row_idx += 1

        self.desc_placeholder_canvas = tk.Canvas(self.editable_frame, borderwidth=0)
        self.desc_placeholder_scrollbar = ttk.Scrollbar(self.editable_frame, orient="vertical", command=self.desc_placeholder_canvas.yview)
        self.desc_placeholder_canvas.configure(yscrollcommand=self.desc_placeholder_scrollbar.set)

        self.desc_placeholder_scrollbar.grid(row=row_idx, column=3, sticky=(tk.N, tk.S, tk.E))
        self.desc_placeholder_canvas.grid(row=row_idx, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S)) # Canvas spans 3 columns
        self.editable_frame.rowconfigure(row_idx, weight=1) # This row expands vertically

        self.desc_placeholder_inner_frame = ttk.Frame(self.desc_placeholder_canvas)
        self.desc_placeholder_canvas.create_window((0, 0), window=self.desc_placeholder_inner_frame, anchor="nw")
        self.desc_placeholder_inner_frame.bind("<Configure>", lambda e: self.desc_placeholder_canvas.configure(scrollregion=self.desc_placeholder_canvas.bbox("all")))
        self.desc_placeholder_inner_frame.bind_all("<MouseWheel>", self._on_mousewheel)
        # Inner frame columns for dynamic entries
        self.desc_placeholder_inner_frame.columnconfigure(0, weight=0) # {i}: Label
        self.desc_placeholder_inner_frame.columnconfigure(1, weight=1) # Value Entry (takes remaining width)


        # placeholder_entries will store info {unique_key: {info dict}, ...}
        self.placeholder_entries = {}

        save_frame = ttk.Frame(self.master, padding="10")
        save_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E))

        ttk.Button(save_frame, text="Save Changes", command=self.save_data).grid(row=0, column=0, sticky=tk.W)

        self.status_label = ttk.Label(self.master, text="Ready", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E))

    # PART 2/7 (cont.): Skill Filtering (No changes needed here)
    def filter_skills(self):
        char_code_str = self.char_code_entry.get().strip()
        if not char_code_str:
            messagebox.showwarning("Warning", "Please enter a character code.")
            return

        try:
            char_code = int(char_code_str)
        except ValueError:
            messagebox.showwarning("Warning", "Invalid character code. Please enter a number.")
            return

        self.filtered_skills = {}
        skill_keys = []

        for skill_id, skill_data in self.data.items():
            if isinstance(skill_data, dict) and skill_data.get("characterCode") == char_code:
                skill_key = skill_data.get("skillKey")
                if skill_key:
                    self.filtered_skills[skill_key] = skill_data
                    skill_keys.append(skill_key)

        custom_order_map = {'P': 0, 'Q': 1, 'W': 2, 'E': 3, 'R': 4}
        def skill_key_sort_key(k):
            match = re.match(r'([A-Z]+)(\d+)?', k)
            if match:
                alpha_part = match.group(1)
                num_part = int(match.group(2)) if match.group(2) else 0
                return (alpha_part not in custom_order_map, custom_order_map.get(alpha_part, len(custom_order_map)), num_part, k)
            else:
                return (True, len(custom_order_map), 0, k)

        skill_keys.sort(key=skill_key_sort_key)

        if not skill_keys:
            messagebox.showinfo("Info", f"No skills found for character code {char_code}.")
            self.skill_key_combobox['values'] = []
            self.clear_skill_display()
            self.current_skill_key = None
            self.current_skill_id = None
        else:
            self.skill_key_combobox['values'] = skill_keys
            self.skill_key_combobox.set('')
            self.clear_skill_display()
            self.current_skill_key = None
            self.current_skill_id = None
            self.status_label.config(text=f"Found {len(skill_keys)} skills for character {char_code_str}")


    # PART 3/7: Skill Selection and Clearing Logic (select_skill, clear_skill_display, clear_editable_fields)
    # select_skill method (Modified)
    def select_skill(self, event=None):
        """Displays information for the selected skill key."""
        selected_key = self.skill_key_combobox.get()
        if not selected_key or selected_key not in self.filtered_skills:
            self.clear_skill_display()
            self.current_skill_key = None
            self.current_skill_id = None
            return

        self.current_skill_key = selected_key
        skill_data = self.filtered_skills[selected_key]

        # Find the corresponding skill_id in the original data dictionary
        self.current_skill_id = None
        char_code_str = self.char_code_entry.get().strip()
        try:
             char_code = int(char_code_str)
             for skill_id, data in self.data.items():
                  if isinstance(data, dict) and data.get("characterCode") == char_code and data.get("skillKey") == selected_key:
                       self.current_skill_id = skill_id
                       break
        except ValueError:
             print(f"Error finding skill_id: Invalid character code {char_code_str}.")
             self.current_skill_id = None


        # Display read-only info
        self.skill_name_label.config(text=skill_data.get("skillName", "N/A"))

        # --- Modified to use tk.Text and apply initial orange tags ---
        l10n_coef_text = skill_data.get("l10nCoefText", "N/A")
        self.l10n_coef_text_widget.config(state='normal')
        self.l10n_coef_text_widget.delete('1.0', tk.END)
        self.l10n_coef_text_widget.insert('1.0', l10n_coef_text)
        self._apply_placeholder_tags(self.l10n_coef_text_widget, 'orange_ph') # Apply orange tags
        self.l10n_coef_text_widget.config(state='disabled')

        l10n_desc_text = skill_data.get("l10nDescText", "N/A")
        self.l10n_desc_text_widget.config(state='normal')
        self.l10n_desc_text_widget.delete('1.0', tk.END)
        self.l10n_desc_text_widget.insert('1.0', l10n_desc_text)
        self._apply_placeholder_tags(self.l10n_desc_text_widget, 'orange_ph') # Apply orange tags
        self.l10n_desc_text_widget.config(state='disabled')
        # -----------------------------------------------------------

        self.l10n_lobby_desc_text_label.config(text=skill_data.get("l10nLobbyDescText", "N/A"))
        self.l10n_expansion_tip_text_label.config(text=skill_data.get("l10nExpansionTipText", "N/A"))

        self.info_inner_frame.update_idletasks()
        self.info_canvas.config(scrollregion=self.info_canvas.bbox("all"))
        self.info_canvas.yview_moveto(0)

        self.display_editable_fields(skill_data)
        self.status_label.config(text=f"Selected skill: {selected_key} (ID: {self.current_skill_id})")

    # clear_skill_display method (Modified)
    def clear_skill_display(self):
        """Clears all displayed skill information and editable fields."""
        self.skill_name_label.config(text="")

        # --- Modified to clear tk.Text widgets ---
        self.l10n_coef_text_widget.config(state='normal')
        self.l10n_coef_text_widget.delete('1.0', tk.END)
        self.l10n_coef_text_widget.config(state='disabled')

        self.l10n_desc_text_widget.config(state='normal')
        self.l10n_desc_text_widget.delete('1.0', tk.END)
        self.l10n_desc_text_widget.config(state='disabled')
        # ---------------------------------------

        self.l10n_lobby_desc_text_label.config(text="")
        self.l10n_expansion_tip_text_label.config(text="")

        self.info_inner_frame.update_idletasks()
        self.info_canvas.config(scrollregion=self.info_canvas.bbox("all"))
        self.info_canvas.yview_moveto(0)

        self.clear_editable_fields()
        self.status_label.config(text="Skill display cleared.")

    # clear_editable_fields method (No changes needed here)
    def clear_editable_fields(self):
        """Clears the *dynamic* placeholder entries and clears content of *static* entries."""
        for widget in self.coef_placeholder_inner_frame.winfo_children():
             widget.destroy()
        for widget in self.desc_placeholder_inner_frame.winfo_children():
             widget.destroy()

        self.placeholder_entries = {}

        self.coef_placeholder_inner_frame.update_idletasks()
        self.coef_placeholder_canvas.config(scrollregion=self.coef_placeholder_canvas.bbox("all"))
        self.coef_placeholder_canvas.yview_moveto(0)

        self.desc_placeholder_inner_frame.update_idletasks()
        self.desc_placeholder_canvas.config(scrollregion=self.desc_placeholder_canvas.bbox("all"))
        self.desc_placeholder_canvas.yview_moveto(0)

        self.cooldown_entry.delete(0, tk.END)
        self.cost_type_entry.delete(0, tk.END)
        self.cost_entry.delete(0, tk.END)
        self.range_entry.delete(0, tk.END)

    # add_placeholder_entry_row method (Modified)
    def add_placeholder_entry_row(self, parent_frame, row_idx, placeholder_text, value_string, source):
        """Helper to add a row of placeholder input fields."""
        label_text = f"{{{placeholder_text}}}:"
        placeholder_label = ttk.Label(parent_frame, text=label_text)
        placeholder_label.grid(row=row_idx, column=0, sticky=tk.W)

        value_entry = ttk.Entry(parent_frame, width=50)
        value_entry.insert(0, str(value_string))
        value_entry.grid(row=row_idx, column=1, sticky=(tk.W, tk.E))

        # --- Bind FocusIn and FocusOut events ---
        # Pass source ('coef'/'desc') and placeholder_text ('{i}') to handlers
        value_entry.bind('<FocusIn>', lambda e, s=source, pt=placeholder_text: self._on_placeholder_focus_in(e, s, pt))
        value_entry.bind('<FocusOut>', lambda e, s=source, pt=placeholder_text: self._on_placeholder_focus_out(e, s, pt))
        # -----------------------------------------

        unique_key = f"{placeholder_text}_{source}"
        self.placeholder_entries[unique_key] = {
            "placeholder_text": placeholder_text,
            "value_entry": value_entry,
            "source": source
        }

    # --- New Methods for Placeholder Highlighting ---
    # _apply_placeholder_tags method (New)
    def _apply_placeholder_tags(self, text_widget, tag_name):
        """Applies a given tag to all {n} occurrences in a tk.Text widget."""
        # Ensure widget is in normal state to modify tags
        original_state = text_widget.cget('state')
        if original_state != 'normal':
             text_widget.config(state='normal')

        text_widget.tag_remove(tag_name, '1.0', tk.END) # Remove existing tags first

        # Use search method with regexp to find all {n}
        start_index = '1.0'
        while True:
            match_start = text_widget.search(r'\{\d+\}', start_index, tk.END, regexp=True, nocase=True) # nocase=True might be useful
            if not match_start:
                break # No more matches

            # Find the end index of the match
            match_text = text_widget.get(match_start, tk.END)
            ph_match = re.match(r'\{\d+\}', match_text)
            if ph_match:
                 match_len = len(ph_match.group(0))
                 end_index = text_widget.index(f"{match_start}+{match_len}c")

                 # Apply the tag
                 text_widget.tag_add(tag_name, match_start, end_index)

                 # Start the next search from the end of the current match
                 start_index = end_index
            else:
                 # Should theoretically not happen if search found a match
                 start_index = text_widget.index(f"{match_start}+1c") # Move past the current position


        # Restore original state
        if original_state != 'normal':
             text_widget.config(state=original_state)


    # _on_placeholder_focus_in method (New)
    def _on_placeholder_focus_in(self, event, source, placeholder_text):
        """Highlights the specific placeholder in red when its entry field gains focus."""
        target_widget = None
        if source == 'coef':
            target_widget = self.l10n_coef_text_widget
        elif source == 'desc':
            target_widget = self.l10n_desc_text_widget

        if target_widget:
            # Ensure text widget is in normal state to modify tags
            original_state = target_widget.cget('state')
            if original_state != 'normal':
                 target_widget.config(state='normal')

            # Remove any existing red highlights first
            target_widget.tag_remove('red_ph', '1.0', tk.END)

            # Find all occurrences of the specific placeholder_text (e.g., "{0}")
            start_index = '1.0'
            while True:
                 match_start = target_widget.search(placeholder_text, start_index, tk.END, nocase=True) # Case-insensitive search
                 if not match_start:
                      break # No more matches

                 # Calculate the end index
                 end_index = target_widget.index(f"{match_start}+{len(placeholder_text)}c")

                 # Apply the red tag
                 target_widget.tag_add('red_ph', match_start, end_index)

                 # Start the next search from the end of the current match
                 start_index = end_index

            # Restore original state
            if original_state != 'normal':
                 target_widget.config(state=original_state)


    # _on_placeholder_focus_out method (New)
    def _on_placeholder_focus_out(self, event, source, placeholder_text):
        """Removes the red highlight and reapplies orange when the entry field loses focus."""
        target_widget = None
        if source == 'coef':
            target_widget = self.l10n_coef_text_widget
        elif source == 'desc':
            target_widget = self.l10n_desc_text_widget

        if target_widget:
            # Ensure text widget is in normal state to modify tags
            original_state = target_widget.cget('state')
            if original_state != 'normal':
                 target_widget.config(state='normal')

            # Remove the red highlights applied by FocusIn
            target_widget.tag_remove('red_ph', '1.0', tk.END)

            # Reapply the orange tags to all placeholders in this widget
            self._apply_placeholder_tags(target_widget, 'orange_ph')

            # Restore original state
            if original_state != 'normal':
                 target_widget.config(state=original_state)

    # --- End of New Methods ---


    # PART 4/7: Display Editable Fields Logic (display_editable_fields)
    # display_editable_fields method (No changes needed here)
    def display_editable_fields(self, skill_data):
        """Populates the editable fields based on skill data using the new placeholder structure."""
        self.clear_editable_fields()

        cooldown_val = skill_data.get("cooldown", [])
        if isinstance(cooldown_val, list):
             self.cooldown_entry.insert(0, ", ".join(map(str, cooldown_val)))
        else:
             self.cooldown_entry.insert(0, str(cooldown_val if cooldown_val is not None else ""))

        cost_type_val = skill_data.get("costType", "")
        self.cost_type_entry.insert(0, str(cost_type_val if cost_type_val is not None else ""))

        cost_val = skill_data.get("cost", [])
        if isinstance(cost_val, list):
             self.cost_entry.insert(0, ", ".join(map(str, cost_val)))
        else:
             self.cost_entry.insert(0, str(cost_val if cost_val is not None else ""))

        range_val = skill_data.get("range", [])
        if isinstance(range_val, list):
             self.range_entry.insert(0, ", ".join(map(str, range_val)))
        else:
             self.range_entry.insert(0, str(range_val if range_val is not None else ""))

        placeholder_data = skill_data.get("placeholder", {})
        if not isinstance(placeholder_data, dict):
            placeholder_data = {}
            print(f"Warning: Placeholder for skill {self.current_skill_key} is not a dictionary upon load. Using empty dict.")

        coef_placeholder_data = placeholder_data.get("coef", {})
        desc_placeholder_data = placeholder_data.get("desc", {})

        if not isinstance(coef_placeholder_data, dict):
             coef_placeholder_data = {}
             print(f"Warning: placeholder.coef is not a dictionary. Using empty dict.")

        if not isinstance(desc_placeholder_data, dict):
             desc_placeholder_data = {}
             print(f"Warning: placeholder.desc is not a dictionary. Using empty dict.")

        coef_row_idx = 0
        sorted_coef_placeholders = sorted(coef_placeholder_data.items(),
                                          key=lambda item: int(re.match(r'\{(\d+)\}', item[0]).group(1)) if re.match(r'\{\d+\}', item[0]) else float('inf'))

        for placeholder_text, value_string in sorted_coef_placeholders:
            self.add_placeholder_entry_row(self.coef_placeholder_inner_frame, coef_row_idx, placeholder_text, value_string, 'coef')
            coef_row_idx += 1

        desc_row_idx = 0
        sorted_desc_placeholders = sorted(desc_placeholder_data.items(),
                                          key=lambda item: int(re.match(r'\{(\d+)\}', item[0]).group(1)) if re.match(r'\{\d+\}', item[0]) else float('inf'))

        for placeholder_text, value_string in sorted_desc_placeholders:
            self.add_placeholder_entry_row(self.desc_placeholder_inner_frame, desc_row_idx, placeholder_text, value_string, 'desc')
            desc_row_idx += 1

        self.coef_placeholder_inner_frame.update_idletasks()
        self.coef_placeholder_canvas.config(scrollregion=self.coef_placeholder_canvas.bbox("all"))
        self.coef_placeholder_canvas.yview_moveto(0)

        self.desc_placeholder_inner_frame.update_idletasks()
        self.desc_placeholder_canvas.config(scrollregion=self.desc_placeholder_canvas.bbox("all"))
        self.desc_placeholder_canvas.yview_moveto(0)


    # PART 5/7: Parsing Helper Methods (No changes needed here)
    def parse_array_input(self, input_str):
        """Parses a comma-separated string into a list of floats, ints, or strings."""
        input_str = input_str.strip()
        if not input_str:
            return []

        values = []
        items = [item.strip() for item in input_str.split(',')]

        for item in items:
             if not item:
                 continue
             try:
                 if '.' in item:
                     values.append(float(item))
                 else:
                     values.append(int(item))
             except ValueError:
                 values.append(item)

        return values

    def parse_dbdesc_value(self, value_str):
        """
        This method was used by the 'Convert' button (now removed).
        It is currently NOT used in the updated flow.
        """
        return []

    # PART 6/7: Convert Logic (Removed)
    # This part is intentionally empty.


    # PART 7/7: Save Logic (save_data)
    # save_data method (No changes needed here from the last provided version)
    def save_data(self):
        """
        현재 편집 중인 스킬 데이터를 저장합니다.
        UI에 표시된 수정 내용을 내부 데이터 구조에 반영하고 파일로 저장합니다.
        """
        print("Save button clicked!")

        saving_skill_id = getattr(self, 'current_skill_id', None)

        if saving_skill_id is None:
            messagebox.showwarning("Warning", "No skill selected to save.")
            print("Save cancelled: No skill selected.")
            return

        saving_skill_id_str = str(saving_skill_id)
        print(f"Attempting to save skill with ID: {saving_skill_id_str}")

        skill_data_to_update = self.data.get(saving_skill_id_str, None)

        if skill_data_to_update is None:
            error_message = f"Internal Error: Skill data not found in internal dictionary for ID: {saving_skill_id_str}."
            messagebox.showerror("Error", error_message)
            print(error_message)
            return

        print(f"Found skill data for update (ID {saving_skill_id_str}, name: {skill_data_to_update.get('skillName', 'Unknown Name')})")

        try:
            if hasattr(self, 'cooldown_entry'):
                 skill_data_to_update["cooldown"] = self.parse_array_input(self.cooldown_entry.get())
            if hasattr(self, 'cost_type_entry'):
                 skill_data_to_update["costType"] = self.cost_type_entry.get()
            if hasattr(self, 'cost_entry'):
                 skill_data_to_update["cost"] = self.parse_array_input(self.cost_entry.get())
            if hasattr(self, 'range_entry'):
                 skill_data_to_update["range"] = self.parse_array_input(self.range_entry.get())

            if "placeholder" not in skill_data_to_update or not isinstance(skill_data_to_update["placeholder"], dict):
                 skill_data_to_update["placeholder"] = {"coef": {}, "desc": {}}
            if "coef" not in skill_data_to_update["placeholder"] or not isinstance(skill_data_to_update["placeholder"]["coef"], dict):
                 skill_data_to_update["placeholder"]["coef"] = {}
            if "desc" not in skill_data_to_update["placeholder"] or not isinstance(skill_data_to_update["placeholder"]["desc"], dict):
                 skill_data_to_update["placeholder"]["desc"] = {}

            updated_coef_placeholders = {}
            updated_desc_placeholders = {}

            for entry_info in self.placeholder_entries.values():
                placeholder_text = entry_info.get("placeholder_text")
                value_entry = entry_info.get("value_entry")
                source = entry_info.get("source")

                if placeholder_text and value_entry and source in ('coef', 'desc'):
                    value_str = value_entry.get().strip()
                    if source == 'coef':
                        updated_coef_placeholders[placeholder_text] = value_str
                    elif source == 'desc':
                        updated_desc_placeholders[placeholder_text] = value_str

            skill_data_to_update["placeholder"]["coef"].clear()
            skill_data_to_update["placeholder"]["coef"].update(updated_coef_placeholders)

            skill_data_to_update["placeholder"]["desc"].clear()
            skill_data_to_update["placeholder"]["desc"].update(updated_desc_placeholders)

            print(f"UI changes successfully reflected in internal data for ID {saving_skill_id_str}.")

        except Exception as e:
            error_message = f"Error reflecting UI changes to skill data (ID: {saving_skill_id_str}): {e}"
            messagebox.showerror("Error", error_message)
            print(error_message)
            import traceback
            traceback.print_exc()
            return

        try:
            backup_path = self.json_path + ".bak"
            if os.path.exists(self.json_path):
                try:
                    os.replace(self.json_path, backup_path)
                except OSError:
                     shutil.copy2(self.json_path, backup_path)

            with open(self.json_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=4, ensure_ascii=False)

            print(f"Skill data for ID {saving_skill_id_str} saved successfully to {self.json_path}.")
            self.status_label.config(text=f"Saved changes for skill ID {saving_skill_id_str}.")
            messagebox.showinfo("Success", f"Changes saved successfully for skill ID {saving_skill_id_str}.")

        except Exception as e:
            error_message = f"Failed to save file '{self.json_path}': {e}"
            self.status_label.config(text=f"Save error: {e}")

            if os.path.exists(backup_path):
                try:
                    os.replace(backup_path, self.json_path)
                    error_message += "\nOriginal file restored from backup."
                    self.status_label.config(text=f"Save error: {e}, Backup restored.")
                except Exception as restore_e:
                    error_message += f"\nAlso failed to restore backup: {restore_e}\nManual intervention needed!"
                    self.status_label.config(text=f"Save/Restore error: {e}, {restore_e}")
            else:
                 error_message += "\nNo backup available."
                 self.status_label.config(text=f"Save error: {e}, No backup.")

            messagebox.showerror("Error", error_message)

# --- End of save_data method ---


# Main execution block (No changes needed here)
if __name__ == "__main__":
    root = tk.Tk()
    root.geometry("1200x800")
    app = SkillEditorApp(root)
    root.mainloop()