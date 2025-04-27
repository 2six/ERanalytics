# -*- coding: utf-8 -*- # 파일 인코딩 명시 (한글 주석/문자열 처리)

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import re
import shutil # Added for safer backup

class SkillEditorApp:
    def __init__(self, master):
        self.master = master
        master.title("Manual Skill Stats Editor")

        # --- Configuration ---
        # JSON 파일 경로. 필요에 따라 수정하세요.
        self.json_path = 'data/er/manual_skill_stats.json' # 이 부분을 실제 경로로 수정했는지 다시 확인하세요

        # --- Data Storage ---
        self.data = {}
        self.filtered_skills = {} # characterCode로 필터링된 스킬
        self.current_skill_key = None # 현재 선택된 skillKey

        # --- GUI Layout ---
        # GUI 위젯을 먼저 생성하여 status_label 등이 존재하도록 합니다.
        self.create_widgets()
        # 위젯 생성 후 데이터를 로드합니다.
        self.load_data()


    def load_data(self):
        """Loads data from the specified JSON file."""
        if not os.path.exists(self.json_path):
            messagebox.showerror("Error", f"File not found: {self.json_path}")
            # self.status_label이 create_widgets에서 생성되었으므로 이제 사용 가능
            self.status_label.config(text="Error: File not found")
            return

        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            self.status_label.config(text=f"Successfully loaded {self.json_path}")
        except json.JSONDecodeError:
            messagebox.showerror("Error", f"Invalid JSON in {self.json_path}")
            self.status_label.config(text="Error: Invalid JSON")
            self.data = {} # Clear potentially corrupted data
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load file: {e}")
            self.status_label.config(text=f"Error: {e}")
            self.data = {}


    def _on_mousewheel(self, event):
        """Handles mousewheel scrolling for canvases."""
        # Identify the canvas that should be scrolled
        # On Windows, event.widget is the widget *under* the mouse.
        # Find the parent canvas of the widget under the mouse.
        canvas = None
        widget_under_mouse = event.widget
        while widget_under_mouse:
            if isinstance(widget_under_mouse, tk.Canvas):
                canvas = widget_under_mouse
                break
            # Use winfo_parent() instead of accessing _parent attribute directly
            widget_under_mouse = widget_under_mouse.winfo_parent()


        if canvas:
             # Scroll the canvas vertically
             # On Windows, event.delta is typically 120 per scroll "notch"
             canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    # 나머지 메소드는 다음 부분에 이어집니다...
    # create_widgets, filter_skills 등등
    # PART 2/7: GUI Creation (New Layout with Scrollbars and Width Adjustments) and Skill Filtering
    # Add this code immediately after the _on_mousewheel method

    def create_widgets(self):
        # Configure the main window's grid to have two main columns for content
        self.master.columnconfigure(0, weight=1) # Left column (Info/dbDesc) - Can grow
        self.master.columnconfigure(1, weight=2) # Right column (Editable Stats) - Grows more


        # Row configuration for the main window
        self.master.rowconfigure(0, weight=0) # File path row
        self.master.rowconfigure(1, weight=0) # Filter row
        self.master.rowconfigure(2, weight=0) # Skill select row
        self.master.rowconfigure(3, weight=1) # Main content area (Info frame in col 0, Editable frame in col 1)
        self.master.rowconfigure(4, weight=0) # dbDesc frame row in col 0 (Editable frame spans row 3 & 4)
        self.master.rowconfigure(5, weight=0) # Save button row
        self.master.rowconfigure(6, weight=0) # Status bar row


        # Top section (spans across both conceptual columns)
        # Frame for File Path and Load Status
        file_frame = ttk.Frame(self.master, padding="10")
        file_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E)) # Spans 2 columns
        ttk.Label(file_frame, text="JSON File Path:").grid(row=0, column=0, sticky=tk.W)
        self.file_path_label = ttk.Label(file_frame, text=self.json_path)
        self.file_path_label.grid(row=0, column=1, sticky=(tk.W, tk.E))
        file_frame.columnconfigure(1, weight=1) # Allow path label to expand

        # Frame for Character Code Input and Filter
        filter_frame = ttk.Frame(self.master, padding="10")
        filter_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E)) # Spans 2 columns
        ttk.Label(filter_frame, text="Character Code:").grid(row=0, column=0, sticky=tk.W)
        self.char_code_entry = ttk.Entry(filter_frame, width=10)
        self.char_code_entry.grid(row=0, column=1, sticky=(tk.W))
        self.char_code_entry.bind('<Return>', lambda event=None: self.filter_skills()) # Enter key filter
        ttk.Button(filter_frame, text="Filter", command=self.filter_skills).grid(row=0, column=2, sticky=tk.W)


        # Frame for Skill Selection
        skill_select_frame = ttk.Frame(self.master, padding="10")
        skill_select_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E)) # Spans 2 columns
        ttk.Label(skill_select_frame, text="Select Skill:").grid(row=0, column=0, sticky=tk.W)
        self.skill_key_combobox = ttk.Combobox(skill_select_frame, state="readonly", width=5)
        self.skill_key_combobox.grid(row=0, column=1, sticky=(tk.W))
        self.skill_key_combobox.bind("<<ComboboxSelected>>", self.select_skill)


        # --- Main Content Area (Split into Left and Right) ---

        # Left Column: Skill Information (Read-only) + dbDesc
        # Frame for Displaying Skill Info (Read-only) - Now with Scrollbar
        info_frame = ttk.LabelFrame(self.master, text="Skill Information (Read-only)", padding="10")
        # Place in left column (col 0), spans multiple rows (3 and 4)
        info_frame.grid(row=3, column=0, rowspan=2, sticky=(tk.W, tk.E, tk.N, tk.S)) # Spans rows 3 and 4


        # Create a Canvas and Scrollbar for the info frame
        self.info_canvas = tk.Canvas(info_frame)
        self.info_scrollbar = ttk.Scrollbar(info_frame, orient="vertical", command=self.info_canvas.yview)
        self.info_canvas.configure(yscrollcommand=self.info_scrollbar.set)

        self.info_scrollbar.pack(side="right", fill="y")
        self.info_canvas.pack(side="left", fill="both", expand=True)

        # Create a Frame inside the canvas to hold the info labels
        self.info_inner_frame = ttk.Frame(self.info_canvas)
        self.info_canvas.create_window((0, 0), window=self.info_inner_frame, anchor="nw")

        # Configure canvas scrolling when the inner frame size changes
        self.info_inner_frame.bind("<Configure>", lambda e: self.info_canvas.configure(scrollregion=self.info_canvas.bbox("all")))
        # Bind mousewheel scrolling to the inner frame and its children (events propagate up)
        self.info_inner_frame.bind_all("<MouseWheel>", self._on_mousewheel)


        # Add info labels inside the info_inner_frame
        self.info_inner_frame.columnconfigure(1, weight=1) # Allow the text label column to expand

        # Adjusted wraplength for wider info area, subtracting space for scrollbar
        text_wraplength = 250 # Increased wraplength (adjust as needed)

        ttk.Label(self.info_inner_frame, text="skillName:").grid(row=0, column=0, sticky=tk.W)
        self.skill_name_label = ttk.Label(self.info_inner_frame, text="", wraplength=text_wraplength, justify="left")
        self.skill_name_label.grid(row=0, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nCoefText:").grid(row=1, column=0, sticky=tk.W)
        self.l10n_coef_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=text_wraplength, justify="left")
        self.l10n_coef_text_label.grid(row=1, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nDescText:").grid(row=2, column=0, sticky=tk.W)
        self.l10n_desc_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=text_wraplength, justify="left")
        self.l10n_desc_text_label.grid(row=2, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nLobbyDescText:").grid(row=3, column=0, sticky=tk.W)
        self.l10n_lobby_desc_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=text_wraplength, justify="left")
        self.l10n_lobby_desc_text_label.grid(row=3, column=1, sticky=(tk.W, tk.E))

        ttk.Label(self.info_inner_frame, text="l10nExpansionTipText:").grid(row=4, column=0, sticky=tk.W)
        self.l10n_expansion_tip_text_label = ttk.Label(self.info_inner_frame, text="", wraplength=text_wraplength, justify="left")
        self.l10n_expansion_tip_text_label.grid(row=4, column=1, sticky=(tk.W, tk.E))


        # Frame for dbDesc Input and Convert Button - Placed below info_frame in the left column
        # Note: dbdesc_frame is now separate from info_frame and grid below it in column 0
        dbdesc_frame = ttk.LabelFrame(self.master, text="dbDesc and Convert", padding="10")
        dbdesc_frame.grid(row=5, column=0, sticky=(tk.W, tk.E, tk.N, tk.S)) # In left column (col 0), below info/dbDesc frame

        ttk.Label(dbdesc_frame, text="dbDesc:").grid(row=0, column=0, sticky=tk.W)
        self.dbdesc_entry = ttk.Entry(dbdesc_frame, width=40) # Adjusted width
        self.dbdesc_entry.grid(row=0, column=1, sticky=(tk.W, tk.E))
        ttk.Button(dbdesc_frame, text="Convert", command=self.convert_logic).grid(row=0, column=2, sticky=tk.W)
        dbdesc_frame.columnconfigure(1, weight=1)


        # Right Column: Editable Stats - Now spanning multiple rows in column 1
        self.editable_frame = ttk.LabelFrame(self.master, text="Editable Stats", padding="10")
        # Placed in the right column (col 1) and spans rows 3, 4, and 5 to be beside info_frame and dbdesc_frame
        self.editable_frame.grid(row=3, column=1, rowspan=3, sticky=(tk.W, tk.E, tk.N, tk.S)) # Spans rows 3, 4, and 5

        # Static editable fields (cooldown, costType, cost, range) - Place them first within editable_frame
        row_idx = 0
        ttk.Label(self.editable_frame, text="cooldown:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cooldown_entry = ttk.Entry(self.editable_frame, width=60) # Adjusted width
        self.cooldown_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E))
        row_idx += 1

        ttk.Label(self.editable_frame, text="costType:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cost_type_entry = ttk.Entry(self.editable_frame, width=20)
        self.cost_type_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W))
        row_idx += 1

        ttk.Label(self.editable_frame, text="cost:").grid(row=row_idx, column=0, sticky=tk.W)
        self.cost_entry = ttk.Entry(self.editable_frame, width=60) # Adjusted width
        self.cost_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E))
        row_idx += 1

        ttk.Label(self.editable_frame, text="range:").grid(row=row_idx, column=0, sticky=tk.W)
        self.range_entry = ttk.Entry(self.editable_frame, width=60) # Adjusted width
        self.range_entry.grid(row=row_idx, column=1, columnspan=2, sticky=(tk.W, tk.E))
        row_idx += 1

        # Separator
        ttk.Separator(self.editable_frame, orient='horizontal').grid(row=row_idx, column=0, columnspan=4, sticky=(tk.W, tk.E), pady=5) # Spans 4 columns now
        row_idx += 1

        # coefficient section label (static) - Place above the scrollable area
        ttk.Label(self.editable_frame, text="coefficient:").grid(row=row_idx, column=0, sticky=tk.W)
        row_idx += 1 # Next row for the scrollable area


        # Create a Canvas and Scrollbar for the coefficient section (within editable_frame)
        self.coef_canvas = tk.Canvas(self.editable_frame) # Parent is editable_frame
        self.coef_scrollbar = ttk.Scrollbar(self.editable_frame, orient="vertical", command=self.coef_canvas.yview) # Parent is editable_frame
        self.coef_canvas.configure(yscrollcommand=self.coef_scrollbar.set)

        # Place the scrollbar and canvas in the grid within editable_frame
        # Adjust column placement as editable_frame now spans columns 1-3 in its grid (col 0 for label)
        self.coef_scrollbar.grid(row=row_idx, column=3, sticky=(tk.N, tk.S, tk.E)) # Scrollbar in column 3 within editable_frame's grid
        self.coef_canvas.grid(row=row_idx, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S)) # Canvas spans columns 0-2 within editable_frame's grid
        # Make the row containing the coefficient canvas expandable
        self.editable_frame.rowconfigure(row_idx, weight=1)


        # Create a Frame inside the coefficient canvas to hold the dynamic entries
        self.coefficient_frame = ttk.Frame(self.coef_canvas) # Parent is the canvas
        self.coef_canvas.create_window((0, 0), window=self.coefficient_frame, anchor="nw")

        # Configure canvas scrolling when the inner frame size changes
        self.coefficient_frame.bind("<Configure>", lambda e: self.coef_canvas.configure(scrollregion=self.coef_canvas.bbox("all")))
        # Bind mousewheel scrolling to the inner frame and its children (events propagate up)
        self.coefficient_frame.bind_all("<MouseWheel>", self._on_mousewheel)


        self.coefficient_entries = {} # Stores Entry widgets for coefficient key/value, keyed by row index within coefficient_frame

        # Configure weights within the dynamically populated coefficient_frame (inside canvas)
        # These ensure the entry widgets expand correctly within the inner frame
        self.coefficient_frame.columnconfigure(0, weight=0) # Key Label column ({i}: or Key:)
        self.coefficient_frame.columnconfigure(1, weight=1) # Key Entry column
        self.coefficient_frame.columnconfigure(2, weight=2) # Value Entry column


        # Bottom section (spans across both conceptual columns)
        # Frame for Save Button
        # This frame is now placed in row 5, spanning both columns in the main grid
        save_frame = ttk.Frame(self.master, padding="10")
        save_frame.grid(row=6, column=0, columnspan=2, sticky=(tk.W, tk.E)) # Spans 2 columns

        ttk.Button(save_frame, text="Save Changes", command=self.save_data).grid(row=0, column=0, sticky=tk.W)

        # Status Bar
        # This label is now placed in row 6, spanning both columns in the main grid
        self.status_label = ttk.Label(self.master, text="Ready", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.grid(row=7, column=0, columnspan=2, sticky=(tk.W, tk.E)) # Spans 2 columns


    def filter_skills(self):
        """Filters skills based on character code and populates the skill key dropdown."""
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

        # Iterate through the top-level keys (which are often skill IDs like "1076400")
        # and check the 'characterCode' field within the nested object.
        for skill_id, skill_data in self.data.items():
            if isinstance(skill_data, dict) and skill_data.get("characterCode") == char_code:
                skill_key = skill_data.get("skillKey")
                if skill_key:
                    self.filtered_skills[skill_key] = skill_data # Store the data by skillKey
                    skill_keys.append(skill_key)

        # Custom sort order: P, Q, W, E, R first, then others alphabetically, handling numbers like Q2
        custom_order_map = {'P': 0, 'Q': 1, 'W': 2, 'E': 3, 'R': 4}
        def skill_key_sort_key(k):
            # Extract leading non-digit part and trailing digit part
            match = re.match(r'([A-Z]+)(\d+)?', k)
            if match:
                alpha_part = match.group(1)
                num_part = int(match.group(2)) if match.group(2) else 0 # Treat no number as 0
                # Sort by:
                # 1. Whether the alpha part is in the custom order (False < True)
                # 2. Index in custom order (if in custom order)
                # 3. The numeric part
                # 4. The original string key (fallback)
                return (alpha_part not in custom_order_map, custom_order_map.get(alpha_part, len(custom_order_map)), num_part, k)
            else:
                # For keys that don't match the expected pattern, sort them at the end
                return (True, len(custom_order_map), 0, k) # Place at the end

        skill_keys.sort(key=skill_key_sort_key)


        if not skill_keys:
            messagebox.showinfo("Info", f"No skills found for character code {char_code}.")
            self.skill_key_combobox['values'] = []
            self.clear_skill_display()
            self.current_skill_key = None
        else:
            self.skill_key_combobox['values'] = skill_keys
            self.skill_key_combobox.set('') # Clear current selection
            self.clear_skill_display()
            self.current_skill_key = None
            self.status_label.config(text=f"Found {len(skill_keys)} skills for character {char_code_str}")

    # 나머지 메소드는 다음 부분에 이어집니다...
    # select_skill, clear_skill_display, clear_editable_fields, add_coefficient_entry_row 등
    # PART 3/7: Skill Selection and Clearing Logic
    # Add this code immediately after the filter_skills method

    def select_skill(self, event=None):
        """Displays information for the selected skill key."""
        selected_key = self.skill_key_combobox.get()
        if not selected_key or selected_key not in self.filtered_skills:
            self.clear_skill_display()
            self.current_skill_key = None
            return

        self.current_skill_key = selected_key
        skill_data = self.filtered_skills[selected_key]

        # Display read-only info inside the info_inner_frame (which is inside info_canvas)
        self.skill_name_label.config(text=skill_data.get("skillName", "N/A"))
        self.l10n_coef_text_label.config(text=skill_data.get("l10nCoefText", "N/A"))
        self.l10n_desc_text_label.config(text=skill_data.get("l10nDescText", "N/A"))
        self.l10n_lobby_desc_text_label.config(text=skill_data.get("l10nLobbyDescText", "N/A"))
        self.l10n_expansion_tip_text_label.config(text=skill_data.get("l10nExpansionTipText", "N/A"))

        # Update the scroll region of the info canvas after updating labels
        self.info_inner_frame.update_idletasks() # Update geometry before configuring scrollregion
        self.info_canvas.config(scrollregion=self.info_canvas.bbox("all"))
        self.info_canvas.yview_moveto(0) # Scroll to the top


        # Display dbDesc input (clear previous)
        self.dbdesc_entry.delete(0, tk.END)
        # Note: dbDesc is not stored in the JSON, so this field starts empty

        # Display and populate editable fields
        self.display_editable_fields(skill_data) # This will now use the placeholder dict for initial coefficient display
        self.status_label.config(text=f"Selected skill: {selected_key}")


    def clear_skill_display(self):
        """Clears all displayed skill information and editable fields."""
        # Clear read-only labels
        self.skill_name_label.config(text="")
        self.l10n_coef_text_label.config(text="")
        self.l10n_desc_text_label.config(text="")
        self.l10n_lobby_desc_text_label.config(text="")
        self.l10n_expansion_tip_text_label.config(text="")
        # Update info canvas scrollregion after clearing
        self.info_inner_frame.update_idletasks()
        self.info_canvas.config(scrollregion=self.info_canvas.bbox("all"))
        self.info_canvas.yview_moveto(0) # Scroll to the top


        self.dbdesc_entry.delete(0, tk.END)
        self.clear_editable_fields() # Clears dynamic coefficient and static content
        self.status_label.config(text="Skill display cleared.")

    def clear_editable_fields(self):
        """Clears the *dynamic* coefficient entries and clears content of *static* entries."""
        # Clear dynamic coefficient entries within coefficient_frame (which is inside coef_canvas)
        for widget in self.coefficient_frame.winfo_children():
             widget.destroy()
        self.coefficient_entries = {} # Reset dictionary

        # Update coefficient canvas scrollregion after clearing
        self.coefficient_frame.update_idletasks()
        self.coef_canvas.config(scrollregion=self.coef_canvas.bbox("all"))
        self.coef_canvas.yview_moveto(0) # Scroll to the top


        # Clear content of static editable entries
        self.cooldown_entry.delete(0, tk.END)
        self.cost_type_entry.delete(0, tk.END)
        self.cost_entry.delete(0, tk.END)
        self.range_entry.delete(0, tk.END)

    def add_coefficient_entry_row(self, parent_frame, row_idx, key_label_text, key_value, value_array):
        """Helper to add a row of coefficient input fields."""
        # Label indicating Key (can be "Key:", "{i}:", or "{i}: KeyName")
        key_label = ttk.Label(parent_frame, text=key_label_text)
        key_label.grid(row=row_idx, column=0, sticky=tk.W)

        # Entry for the coefficient key name
        key_entry = ttk.Entry(parent_frame, width=20)
        key_entry.insert(0, str(key_value))
        key_entry.grid(row=row_idx, column=1, sticky=(tk.W, tk.E))

        # Entry for the coefficient value array (displayed as comma-separated string)
        value_entry = ttk.Entry(parent_frame, width=50)
        value_entry.insert(0, ", ".join(map(str, value_array)) if isinstance(value_array, list) else str(value_array))
        value_entry.grid(row=row_idx, column=2, sticky=(tk.W, tk.E))

        # Store the entry widgets. Using row_idx relative to the coefficient_frame
        # This dictionary helps retrieve the entries later (e.g., during save).
        self.coefficient_entries[row_idx] = {"key_entry": key_entry, "value_entry": value_entry, "label_widget": key_label}


    # 나머지 메소드는 다음 부분에 이어집니다...
    # display_editable_fields, parse_array_input, parse_dbdesc_value, convert_logic
    # PART 4/7: Display Editable Fields Logic (Utilizing Placeholder Dictionary)
    # Add this code immediately after the add_coefficient_entry_row method

    def display_editable_fields(self, skill_data):
        """Populates the editable fields based on skill data."""
        self.clear_editable_fields() # Clear previous state first (dynamic entries removed, static cleared)

        # Populate static fields (cooldown, costType, cost, range)
        # Use get() with default to handle missing keys gracefully
        cooldown_val = skill_data.get("cooldown", [])
        # Ensure value is list before joining, handle None/other types gracefully
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
        # Range can contain non-numeric strings like "4m * 2.4m", so just display as is
        if isinstance(range_val, list):
             self.range_entry.insert(0, ", ".join(map(str, range_val)))
        else:
             self.range_entry.insert(0, str(range_val if range_val is not None else ""))


        # --- Populate dynamic coefficient fields using Placeholder Dictionary ---
        coefficient_data = skill_data.get("coefficient", {})
        current_placeholder_dict = skill_data.get("placeholder", {})
        # Ensure the loaded placeholder is actually a dictionary, default to empty dict if not
        if not isinstance(current_placeholder_dict, dict):
            current_placeholder_dict = {}
            print(f"Warning: Placeholder for skill {self.current_skill_key} is not a dictionary upon load. Using empty dict for display.")


        # Prepare data for GUI display in the order defined by placeholder dict (sorted by {n} index)
        coef_display_data_from_placeholder = [] # List of (placeholder_index, key_name, value_array)
        keys_already_displayed = set() # To track keys from coefficient_data that are covered by placeholder

        # Iterate through the placeholder dictionary, sorted by placeholder index {n}
        # Need to sort the dictionary keys first
        sorted_placeholder_keys = sorted(current_placeholder_dict.keys(),
                                         key=lambda k: int(re.match(r'\{(\d+)\}', k).group(1)) if re.match(r'\{(\d+)\}', k) else float('inf')) # Sort by {n} index

        for placeholder_key_str in sorted_placeholder_keys:
             key_name = current_placeholder_dict.get(placeholder_key_str) # e.g., "baseDamage" for "{0}"
             placeholder_match = re.match(r'\{(\d+)\}', placeholder_key_str)

             if key_name and placeholder_match:
                  placeholder_index = int(placeholder_match.group(1))
                  # Get the value array from the coefficient data using the key_name
                  value_array = coefficient_data.get(key_name, []) # Default to empty list if key_name not in coefficient_data

                  coef_display_data_from_placeholder.append((placeholder_index, key_name, value_array))
                  keys_already_displayed.add(key_name) # Mark this key as displayed


        # Add rows to the GUI based on the placeholder data order
        row_idx = 0 # Row index *within the coefficient_frame*
        for placeholder_index, key, value_array in coef_display_data_from_placeholder:
            # Display placeholder index ({i}:) and the key name from the placeholder dict
            self.add_coefficient_entry_row(self.coefficient_frame, row_idx, f"{{{placeholder_index}}}:", key, value_array)
            row_idx += 1


        # Add any coefficient keys that were *not* in the placeholder dictionary afterwards
        remaining_coefficient_keys = [key for key in coefficient_data.keys() if key not in keys_already_displayed]

        if remaining_coefficient_keys:
             # Add a separator or label indicating "Other Coefficients" if desired
             # ttk.Label(self.coefficient_frame, text="--- Others ---").grid(row=row_idx, column=0, columnspan=3, sticky=(tk.W, tk.E))
             # row_idx += 1
             pass # For now, just add them directly

        for key in remaining_coefficient_keys:
             value_array = coefficient_data.get(key, [])
             # Display these with a generic "Key:" label
             self.add_coefficient_entry_row(self.coefficient_frame, row_idx, "Key:", key, value_array)
             row_idx += 1


        # Update the scroll region of the coefficient canvas after populating
        self.coefficient_frame.update_idletasks() # Update geometry before configuring scrollregion
        self.coef_canvas.config(scrollregion=self.coef_canvas.bbox("all"))
        self.coef_canvas.yview_moveto(0) # Scroll to the top


    # 나머지 메소드는 다음 부분에 이어집니다...
    # parse_array_input, parse_dbdesc_value, convert_logic
    # PART 5/7: Parsing Helper Methods (with P/R Skill Length Handling)
    # Add this code immediately after the display_editable_fields method

    def parse_array_input(self, input_str):
        """Parses a comma-separated string into a list of floats, ints, or strings."""
        input_str = input_str.strip()
        if not input_str:
            return [] # Return empty list for empty input

        values = []
        # Split by comma, then strip whitespace
        items = [item.strip() for item in input_str.split(',')]

        for item in items:
             if not item: # Handle consecutive commas or leading/trailing commas resulting in empty items
                 continue
             # Try to convert to number (int or float) if possible, otherwise keep as string
             try:
                 if '.' in item:
                     values.append(float(item))
                 else:
                     values.append(int(item))
             except ValueError:
                 # If it cannot be parsed as a number, keep it as a string
                 values.append(item)

        return values


    def parse_dbdesc_value(self, value_str):
        """
        Parses a value string from dbDesc based on expected formats,
        returning a list. Attempts to determine list length based on skill key (5 for QWE, 3 for PR).
        """
        value_str = value_str.strip()
        if not value_str:
             print(f"Warning: Attempted to parse empty dbDesc value string.")
             return [] # Return empty list

        # Determine expected array length based on skill key
        # Assume 5 for Q, W, E. Assume 3 for P, R. Default to 5 if key not recognized.
        expected_length = 5
        if self.current_skill_key and self.current_skill_key in ['P', 'R']:
             expected_length = 3
        # Add more specific logic if needed for skills like Q2, R2, etc.
        # For now, Q2, R2 will default to 5 based on the 'Q', 'R' check.

        parsed_values = []

        # Case 1: Slash-separated with optional trailing percentage (V/W/X/... or V%/W%/X%...)
        if '/' in value_str:
             parts = [p.strip() for p in value_str.split('/')]
             try:
                 for part in parts:
                     if part.endswith('%'):
                         num_str = part[:-1].strip() if part[:-1] else "0"
                         parsed_values.append(float(num_str) / 100.0)
                     else:
                         parsed_values.append(float(part.strip()))

                 # If we parsed fewer than expected, pad with the last value. If more, truncate.
                 while len(parsed_values) < expected_length and parsed_values:
                      parsed_values.append(parsed_values[-1])
                 return parsed_values[:expected_length] # Return up to expected_length elements

             except ValueError:
                 print(f"Warning: Failed to parse slash/percent value parts as numbers: {value_str}")
                 # Fall through to try other formats

        # Case 2: Single value with percentage (X%)
        if value_str.endswith('%'):
            try:
                num_str = value_str[:-1].strip() if value_str[:-1] else "0"
                value = float(num_str) / 100.0
                 # Expand to expected_length elements
                return [value] * expected_length
            except ValueError:
                 print(f"Warning: Failed to parse single percent value as number: {value_str}")
                 # Fall through

        # Case 3: Single number (Y)
        try:
            value = float(value_str.strip())
            # Expand to expected_length elements
            return [value] * expected_length
        except ValueError:
             print(f"Warning: Failed to parse single number value: '{value_str}'")
             pass # Fall through

        # Case 4: If it contains non-numeric characters common in range/string values (e.g., "4m * 2.4m")
        # Use a pattern that looks for things other than just numbers, periods, hyphens (for negative), and spaces.
        if re.search(r'[^\d\.\s\-]', value_str):
             print(f"Info: Treating value '{value_str}' as a potential string coefficient value.")
             # Store as string array elements, expanded to expected_length
             return [value_str] * expected_length

        # If none of the above formats match, return empty list as a fallback
        print(f"Error: Cannot parse dbDesc value '{value_str}' into a usable coefficient array format. Returning empty list.")
        return [] # Indicate failure

    # 나머지 메소드는 다음 부분에 이어집니다...
    # convert_logic
    # PART 6/7: Convert Logic (Utilizing Placeholder Dictionary and Heuristics)
    # Add this code immediately after the parse_dbdesc_value method

    def convert_logic(self):
        """Applies conversion logic from l10nCoefText and dbDesc to coefficient."""
        if not self.current_skill_key or self.current_skill_key not in self.filtered_skills:
            messagebox.showwarning("Warning", "Please select a skill first.")
            return

        skill_data = self.filtered_skills[self.current_skill_key] # Get current skill data (including its placeholder dictionary)

        # Use the l10nCoefText from the displayed label
        l10n_coef_text = self.l10n_coef_text_label.cget("text")
        dbdesc_text = self.dbdesc_entry.get().strip()

        if not l10n_coef_text or l10n_coef_text == "N/A" or not dbdesc_text:
            messagebox.showwarning("Warning", "l10nCoefText or dbDesc is missing.")
            return

        # Get the placeholder dictionary from the current skill data
        # Assume placeholder is a dictionary like {"{0}": "keyName", ...}
        current_placeholder_dict = skill_data.get("placeholder", {})
        # Ensure the loaded placeholder is actually a dictionary, default to empty dict if not
        if not isinstance(current_placeholder_dict, dict):
            current_placeholder_dict = {}
            print(f"Warning: Placeholder for skill {self.current_skill_key} is not a dictionary. Using empty dict.")


        # Find all {n} placeholders in l10nCoefText IN ORDER OF APPEARANCE
        placeholder_matches_in_order = list(re.finditer(r'\{(\d+)\}', l10n_coef_text))
        # Extract placeholder index values while preserving their order of appearance in l10nCoefText
        ordered_placeholders_indices = [int(m.group(1)) for m in placeholder_matches_in_order]

        # Get unique placeholder indices found in l10nCoefText
        unique_l10n_placeholder_indices = sorted(list(set(ordered_placeholders_indices)))


        # --- Heuristic Value Extraction from dbDesc ---
        # Use regex to find patterns that look like values in dbDesc based on common delimiters.
        split_pattern = r'[/\(\)\+,\s]+|의\s*|초 동안\s*|기절|피해|감소시킵니다|<\s*color=.*?>|<\/\s*color\s*>|\n'
        potential_values_str_list = [item.strip() for item in re.split(split_pattern, dbdesc_text) if item.strip()]

        print(f"Potential value tokens after splitting dbDesc: {potential_values_str_list}")


        # Link extracted values to placeholders based on their sequential order *in the dbDesc tokens*
        # We will assume the Nth extracted value token corresponds to the Nth placeholder *in l10nCoefText order*.
        extracted_values_by_l10n_order = {} # { order_index_in_l10n_coef_text : value_string }
        value_index = 0
        # Iterate through the placeholders based on their APPEARANCE ORDER in l10nCoefText
        for order_idx, placeholder_index in enumerate(ordered_placeholders_indices):
             if value_index < len(potential_values_str_list):
                  extracted_values_by_l10n_order[order_idx] = potential_values_str_list[value_index]
                  value_index += 1
             else:
                  # If dbDesc doesn't have enough values, assign empty string for remaining placeholders
                  print(f"Warning: Not enough value tokens found in dbDesc for placeholder at order index {order_idx} ({{{{original_index}}}}).".format(original_index=placeholder_index))
                  extracted_values_by_l10n_order[order_idx] = ""


        print(f"Extracted value tokens mapped to l10nCoefText order index: {extracted_values_by_l10n_order}")


        # --- Suggest Key Name based on Placeholder Dictionary or l10nCoefText 주변 텍스트 (Heuristic) ---
        suggested_keys_by_placeholder_index = {} # { placeholder_index: suggested_key_name }
        text_patterns_to_keys = {
            "스킬 증폭": "skillAmp", "최대 체력": "maxHp", "공격력": "attackPower", "방어력": "defense",
            "이동 속도": "movementSpeed", "초 동안 기절": "stunDuration", "초 동안 속박": "rootDuration",
            "초 동안 에어본": "airborneDuration", "초 동안 속도": "duration", "감소시킵니다": "ratio",
            "회복": "healAmount", "보호막": "shieldAmount", "쿨다운": "cooldownReduction",
            "사거리": "range", "치명타 피해": "criticalDamage", "스킬 피해": "baseDamage", "피해": "baseDamage",
            "체력 비례": "maxHpRatio", "잃은 체력 비례": "lostHpRatio", "스킬 증폭의": "skillAmpRatio",
            "공격력의": "attackPowerRatio", "방어력의": "defenseRatio", "최대 체력의": "maxHpRatio",
            "잃은 체력의": "lostHpRatio", "계수": "coefficient"
        }

        # Clean l10nCoefText and map placeholder index to position for proximity check
        clean_l10n_coef_text = re.sub(r'<color=.*?>(.*?)</color>', r'\1', l10n_coef_text)
        clean_l10n_coef_text = re.sub(r'<.*?>', '', clean_l10n_coef_text)
        clean_l10n_coef_text = clean_l10n_coef_text.replace('\\n', ' ')

        # Find placeholders again in the cleaned text to get their positions
        clean_placeholder_matches = list(re.finditer(r'\{(\d+)\}', clean_l10n_coef_text))
        clean_placeholder_map = {int(m.group(1)): (m.start(), m.end()) for m in re.finditer(r'\{(\d+)\}', clean_l10n_coef_text)}


        # Suggest keys for each *unique* placeholder index found
        for i in unique_l10n_placeholder_indices:
            suggested_key_base = f"p{i}" # Default fallback based on original index

            # 1. Check the placeholder dictionary FIRST
            placeholder_key_in_dict = current_placeholder_dict.get(f"{{{i}}}") # Get key from {"{0}": "keyName"} format
            if placeholder_key_in_dict:
                 suggested_key_base = placeholder_key_in_dict
                 # print(f"Debug: Using key '{suggested_key_base}' from placeholder dict for {{{i}}}") # Keep for debugging if needed
            # 2. If not in dict, apply heuristic based on surrounding text
            elif i in clean_placeholder_map:
                 # Apply heuristic only if this is a unique placeholder index
                 if i == 0:
                      suggested_key_base = "baseDamage" # Common heuristic for {0}

                 start_pos, end_pos = clean_placeholder_map[i]
                 text_before = clean_l10n_coef_text[max(0, start_pos - 40) : start_pos].strip()
                 text_after = clean_l10n_coef_text[end_pos : min(len(clean_l10n_coef_text), end_pos + 40)].strip()
                 text_window = text_before + " [PH] " + text_after

                 sorted_patterns = sorted(text_patterns_to_keys.items(), key=lambda item: len(item[0]), reverse=True)

                 found_pattern = False
                 for pattern, key_name in sorted_patterns:
                      # Check if the pattern exists in the text window around the placeholder
                      if pattern in text_window:
                           suggested_key_base = key_name
                           found_pattern = True
                           break # Use the most specific matching pattern found first


            suggested_keys_by_placeholder_index[i] = suggested_key_base


        print(f"Suggested keys by placeholder index: {suggested_keys_by_placeholder_index}")


        # --- Prepare Data for GUI Update in l10nCoefText Order ---
        suggested_coefficient_data_ordered_for_gui = [] # List of (placeholder_index, suggested_key, value_array) tuples in l10nCoefText appearance order

        # Use a SET to track unique key names ASSIGNED in this conversion run
        # This is the fix for the Pylance warning
        assigned_unique_key_tracker = set() # { unique_key_name }

        # Iterate through the placeholders IN THEIR APPEARANCE ORDER in l10nCoefText
        for order_idx, placeholder_index in enumerate(ordered_placeholders_indices):
            value_str = extracted_values_by_l10n_order.get(order_idx, "") # Get extracted value based on order index
            # Pass the current skill key to parse_dbdesc_value for length determination
            parsed_array = self.parse_dbdesc_value(value_str) # parse_dbdesc_value uses self.current_skill_key


            # Get the suggested key name for this specific placeholder index (from dict or heuristic)
            # Use get() with a default fallback just in case suggested_keys_by_placeholder_index is somehow missing an expected key
            suggested_key_base = suggested_keys_by_placeholder_index.get(placeholder_index, f"p{placeholder_index}")

            # Ensure key name is unique within the keys assigned *in this list generation*
            unique_key_name = suggested_key_base
            counter = 1
            # Check against keys ALREADY added to the assigned_unique_key_tracker set
            while unique_key_name in assigned_unique_key_tracker:
                 unique_key_name = f"{suggested_key_base}_{counter}"
                 counter += 1

            # Add the newly generated unique key name to the tracker SET
            assigned_unique_key_tracker.add(unique_key_name)

            # Add the item to the list for GUI display in l10nCoefText appearance order
            # Store original placeholder index, the unique key name generated for GUI, and parsed value array
            suggested_keys_for_gui_display.append((placeholder_index, unique_key_name, parsed_array))


        print(f"Prepared data for GUI (l10nCoefText order): {suggested_keys_for_gui_display}")


        # --- Update the coefficient entry fields in the GUI ---
        # Clear only the dynamic coefficient entries within the scrollable frame
        for widget in self.coefficient_frame.winfo_children():
             widget.destroy()
        self.coefficient_entries = {} # Reset dictionary for new entries

        row_idx = 0 # Row index *within the coefficient_frame* (the frame inside the canvas)
        # Iterate through the prepared list to populate GUI in the correct order
        for placeholder_index, key, value_array in suggested_keys_for_gui_display:
            # Display placeholder index ({i}:) and suggested unique key/parsed value
            # The label will be "{i}:"
            self.add_coefficient_entry_row(self.coefficient_frame, row_idx, f"{{{placeholder_index}}}:", key, value_array)
            row_idx += 1

        # Update the scroll region of the coefficient canvas after populating
        self.coefficient_frame.update_idletasks() # Update geometry before configuring scrollregion
        self.coef_canvas.config(scrollregion=self.coef_canvas.bbox("all"))
        self.coef_canvas.yview_moveto(0) # Scroll to the top

        # Static fields (cooldown, costType, cost, range) are NOT cleared by Convert,
        # so no need to re-populate them here. Their values from select_skill persist.

        self.status_label.config(text="Conversion logic applied. Check suggested values.")

    # 나머지 메소드는 다음 부분에 이어집니다...
    # save_data
    # PART 7/7: Save Logic and Main Execution
    # Add this code immediately after the convert_logic method

    def save_data(self):
        """Saves the modified data back to the JSON file."""
        if not self.current_skill_key or self.current_skill_key not in self.filtered_skills:
            messagebox.showwarning("Warning", "No skill selected to save.")
            return

        char_code_str = self.char_code_entry.get().strip()
        if not char_code_str:
             messagebox.showwarning("Warning", "Character code is missing.")
             return

        try:
             char_code = int(char_code_str)
        except ValueError:
             messagebox.showwarning("Warning", "Invalid character code.")
             return


        # Find the original skill ID in the self.data structure
        skill_id_to_update = None
        # Iterate through top-level keys (skill IDs) to find the one matching charCode and skillKey
        for skill_id, skill_data in self.data.items():
             # Ensure skill_data is a dictionary before accessing its items
             if isinstance(skill_data, dict) and skill_data.get("characterCode") == char_code and skill_data.get("skillKey") == self.current_skill_key:
                  skill_id_to_update = skill_id
                  break

        if skill_id_to_update is None:
             messagebox.showerror("Error", f"Could not find original skill entry for character {char_code_str}, skill {self.current_skill_key} in data.")
             self.status_label.config(text="Error finding original entry.")
             return

        # --- Get updated values from GUI ---
        updated_coefficient = {}
        updated_placeholder_dict = {} # Build the placeholder dictionary from GUI
        coefficient_parse_errors = False # Flag to indicate parsing issues, not necessarily stop save

        # Get coefficient values from the dynamically created entry widgets.
        # Need to get them in the order they appear in the GUI grid to correctly map to placeholder indices.
        # Iterate through the grid slaves in the coefficient_frame (which is inside coef_canvas)
        # and find label ({i}: or Key:), key_entry, value_entry for each row.
        # Group widgets by row index.
        coefficient_rows = {}
        for widget in self.coefficient_frame.winfo_children():
             info = widget.grid_info()
             row = info['row']
             column = info['column']
             if row not in coefficient_rows:
                  coefficient_rows[row] = {}
             # Store widgets by column index
             coefficient_rows[row][column] = widget


        # Process rows in order of row index (corresponds to l10nCoefText appearance order after Convert)
        # or the order they were loaded/displayed initially
        for row_idx in sorted(coefficient_rows.keys()):
             row_widgets = coefficient_rows[row_idx]
             # Get widgets assuming columns 0, 1, 2 for label, key entry, value entry
             label_widget = row_widgets.get(0)
             key_entry = row_widgets.get(1)
             value_entry = row_widgets.get(2)

             if label_widget is None or key_entry is None or value_entry is None:
                 # This row doesn't have the expected structure, skip or warn
                 print(f"Warning: Skipping unexpected widget layout in coefficient row {row_idx} during save.")
                 coefficient_parse_errors = True
                 continue # Skip this entry if structure is unexpected

             # Get the key name from the entry
             key = key_entry.get().strip()
             # Get the value string from the entry
             value_str = value_entry.get().strip()
             # Get the label text (should be "{i}:" or "Key:")
             label_text = label_widget.cget("text")

             if not key:
                 messagebox.showwarning("Warning", f"Coefficient key is empty in row with label '{label_text}'. Skipping this entry for saving.")
                 coefficient_parse_errors = True
                 continue # Skip this entry if key is empty

             # Try to extract the placeholder index {i} from the label text "{i}:"
             placeholder_index = None
             match = re.match(r'\{(\d+)\}:', label_text)
             if match:
                  placeholder_index = int(match.group(1))

             try:
                # Use parse_array_input which handles numbers, strings, etc.
                value_list = self.parse_array_input(value_str)
                updated_coefficient[key] = value_list

                # Populate the placeholder dictionary: "{i}": "keyName"
                # Only add to placeholder_dict if we successfully extracted a placeholder index from the label
                if placeholder_index is not None:
                     updated_placeholder_dict[f"{{{placeholder_index}}}"] = key
                else:
                     # If the label wasn't in the "{i}:" format (e.g., "Key:" from initial load),
                     # we cannot reliably map it back to an {n} placeholder.
                     # In this case, we simply don't add it to the updated_placeholder_dict.
                     print(f"Debug: Label '{label_text}' in row {row_idx} does not match '{{i}}:'. Not adding to placeholder dict.")


             except ValueError as e:
                # If a single coefficient value fails to parse, stop the entire save for data integrity.
                messagebox.showwarning("Warning", f"Failed to parse coefficient value for key '{key}' (from label '{label_text}'): {e}. Stopping save.")
                self.status_label.config(text=f"Error parsing coefficient: {e}")
                return # Stop saving if any coefficient parsing fails
             except Exception as e:
                 # Catch other potential errors during parsing
                 messagebox.showwarning("Warning", f"Unexpected error parsing coefficient value for key '{key}' (from label '{label_text}'): {e}. Stopping save.")
                 self.status_label.config(text=f"Error parsing coefficient: {e}")
                 return # Stop saving


        # Get other editable values from static entries
        try:
             # Use parse_array_input which handles numbers and strings
             updated_cooldown = self.parse_array_input(self.cooldown_entry.get())
             updated_cost = self.parse_array_input(self.cost_entry.get())
             updated_range = self.parse_array_input(self.range_entry.get()) # Range can contain strings
             updated_cost_type = self.cost_type_entry.get().strip()

        except ValueError as e:
            messagebox.showwarning("Warning", f"Failed to parse array value: {e}. Please check cooldown, cost, or range fields. Stopping save.")
            self.status_label.config(text=f"Error parsing array input: {e}")
            return # Stop saving if parsing fails


        # --- Update data structure in memory ---
        # Update the specific skill entry within the main self.data dictionary
        # Ensure the skill_id_to_update still exists in data before updating
        if skill_id_to_update not in self.data:
            messagebox.showerror("Error", f"Original skill entry {skill_id_to_update} unexpectedly missing from loaded data.")
            self.status_label.config(text="Error: Original entry missing.")
            return

        self.data[skill_id_to_update]["coefficient"] = updated_coefficient
        # Update the placeholder with the dictionary built from GUI labels and keys
        # Sort the placeholder dict by the numeric index of the placeholder key for consistent file output order
        # Although dict keys are ordered in modern Python, explicit sorting makes it robust
        sorted_placeholder_items = sorted(updated_placeholder_dict.items(),
                                          key=lambda item: int(re.match(r'\{(\d+)\}', item[0]).group(1)) if re.match(r'\{(\d+)\}', item[0]) else float('inf')) # Sort by {n} index

        # Reconstruct the dictionary to ensure sorted order before saving
        self.data[skill_id_to_update]["placeholder"] = dict(sorted_placeholder_items)


        self.data[skill_id_to_update]["cooldown"] = updated_cooldown
        self.data[skill_id_to_update]["costType"] = updated_cost_type
        self.data[skill_id_to_update]["cost"] = updated_cost
        self.data[skill_id_to_update]["range"] = updated_range

        # Note: filtered_skills refers to the original data loaded or last saved.
        # We are updating self.data, which is the source of truth.
        # No need to explicitly update filtered_skills here.


        # --- Save data back to file ---
        try:
            # Create a backup before saving
            backup_path = self.json_path + ".bak"
            if os.path.exists(self.json_path):
                try:
                    # Use shutil.copy2 to preserve metadata if possible, or os.replace for atomicity
                    os.replace(self.json_path, backup_path) # Rename original to .bak
                except OSError:
                     # Fallback to copy if os.replace fails (e.g., cross-filesystem)
                     import shutil # Ensure shutil is imported if it wasn't already (though it is in part 1)
                     shutil.copy2(self.json_path, backup_path)


            # Save the entire modified data dictionary back to the file
            with open(self.json_path, 'w', encoding='utf-8') as f:
                # Use indent for readability and ensure_ascii=False for Korean characters
                # json.dump will handle array formatting (single line or multi-line) based on its internal logic
                json.dump(self.data, f, indent=4, ensure_ascii=False)

            self.status_label.config(text=f"Successfully saved changes to {self.json_path}")
            messagebox.showinfo("Success", "Changes saved successfully!")

        except Exception as e:
            # If saving fails, try to restore backup
            error_message = f"Failed to save file: {e}"
            self.status_label.config(text=f"Save error: {e}")

            import shutil # Ensure shutil is imported

            if os.path.exists(backup_path):
                try:
                    # Attempt to restore the backup
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
        """Saves the modified data back to the JSON file."""
        if not self.current_skill_key or self.current_skill_key not in self.filtered_skills:
            messagebox.showwarning("Warning", "No skill selected to save.")
            return

        char_code_str = self.char_code_entry.get().strip()
        if not char_code_str:
             messagebox.showwarning("Warning", "Character code is missing.")
             return

        try:
             char_code = int(char_code_str)
        except ValueError:
             messagebox.showwarning("Warning", "Invalid character code.")
             return


        # Find the original skill ID in the self.data structure
        skill_id_to_update = None
        # Iterate through top-level keys (skill IDs) to find the one matching charCode and skillKey
        for skill_id, skill_data in self.data.items():
             # Ensure skill_data is a dictionary before accessing its items
             if isinstance(skill_data, dict) and skill_data.get("characterCode") == char_code and skill_data.get("skillKey") == self.current_skill_key:
                  skill_id_to_update = skill_id
                  break

        if skill_id_to_update is None:
             messagebox.showerror("Error", f"Could not find original skill entry for character {char_code_str}, skill {self.current_skill_key} in data.")
             self.status_label.config(text="Error finding original entry.")
             return

        # --- Get updated values from GUI ---
        updated_coefficient = {}
        updated_placeholder_dict = {} # Build the placeholder dictionary from GUI
        coefficient_parse_errors = False # Flag to indicate parsing issues, not necessarily stop save

        # Get coefficient values from the dynamically created entry widgets.
        # Need to get them in the order they appear in the GUI grid to correctly map to placeholder indices.
        # Iterate through the grid slaves in the coefficient_frame (which is inside coef_canvas)
        # and find label ({i}: or Key:), key_entry, value_entry for each row.
        # Group widgets by row index.
        coefficient_rows = {}
        for widget in self.coefficient_frame.winfo_children():
             info = widget.grid_info()
             row = info['row']
             column = info['column']
             if row not in coefficient_rows:
                  coefficient_rows[row] = {}
             # Store widgets by column index
             coefficient_rows[row][column] = widget


        # Process rows in order of row index (corresponds to l10nCoefText appearance order after Convert)
        # or the order they were loaded/displayed initially
        for row_idx in sorted(coefficient_rows.keys()):
             row_widgets = coefficient_rows[row_idx]
             # Get widgets assuming columns 0, 1, 2 for label, key entry, value entry
             label_widget = row_widgets.get(0)
             key_entry = row_widgets.get(1)
             value_entry = row_widgets.get(2)

             if label_widget is None or key_entry is None or value_entry is None:
                 # This row doesn't have the expected structure, skip or warn
                 print(f"Warning: Skipping unexpected widget layout in coefficient row {row_idx} during save.")
                 coefficient_parse_errors = True
                 continue # Skip this entry if structure is unexpected

             # Get the key name from the entry
             key = key_entry.get().strip()
             # Get the value string from the entry
             value_str = value_entry.get().strip()
             # Get the label text (should be "{i}:" or "Key:")
             label_text = label_widget.cget("text")

             if not key:
                 messagebox.showwarning("Warning", f"Coefficient key is empty in row with label '{label_text}'. Skipping this entry for saving.")
                 coefficient_parse_errors = True
                 continue # Skip this entry if key is empty

             # Try to extract the placeholder index {i} from the label text "{i}:"
             placeholder_index = None
             match = re.match(r'\{(\d+)\}:', label_text)
             if match:
                  placeholder_index = int(match.group(1))

             try:
                # Use parse_array_input which handles numbers, strings, etc.
                value_list = self.parse_array_input(value_str)
                updated_coefficient[key] = value_list

                # Populate the placeholder dictionary: "{i}": "keyName"
                # Only add to placeholder_dict if we successfully extracted a placeholder index from the label
                if placeholder_index is not None:
                     updated_placeholder_dict[f"{{{placeholder_index}}}"] = key
                else:
                     # If the label wasn't in the "{i}:" format (e.g., "Key:" from initial load),
                     # we cannot reliably map it back to an {n} placeholder.
                     # In this case, we simply don't add it to the updated_placeholder_dict.
                     print(f"Debug: Label '{label_text}' in row {row_idx} does not match '{{i}}:'. Not adding to placeholder dict.")


             except ValueError as e:
                # If a single coefficient value fails to parse, stop the entire save for data integrity.
                messagebox.showwarning("Warning", f"Failed to parse coefficient value for key '{key}' (from label '{label_text}'): {e}. Stopping save.")
                self.status_label.config(text=f"Error parsing coefficient: {e}")
                return # Stop saving if any coefficient parsing fails
             except Exception as e:
                 # Catch other potential errors during parsing
                 messagebox.showwarning("Warning", f"Unexpected error parsing coefficient value for key '{key}' (from label '{label_text}'): {e}. Stopping save.")
                 self.status_label.config(text=f"Error parsing coefficient: {e}")
                 return # Stop saving


        # Get other editable values from static entries
        try:
             # Use parse_array_input which handles numbers and strings
             updated_cooldown = self.parse_array_input(self.cooldown_entry.get())
             updated_cost = self.parse_array_input(self.cost_entry.get())
             updated_range = self.parse_array_input(self.range_entry.get()) # Range can contain strings
             updated_cost_type = self.cost_type_entry.get().strip()

        except ValueError as e:
            messagebox.showwarning("Warning", f"Failed to parse array value: {e}. Please check cooldown, cost, or range fields. Stopping save.")
            self.status_label.config(text=f"Error parsing array input: {e}")
            return # Stop saving if parsing fails


        # --- Update data structure in memory ---
        # Update the specific skill entry within the main self.data dictionary
        # Ensure the skill_id_to_update still exists in data before updating
        if skill_id_to_update not in self.data:
            messagebox.showerror("Error", f"Original skill entry {skill_id_to_update} unexpectedly missing from loaded data.")
            self.status_label.config(text="Error: Original entry missing.")
            return

        self.data[skill_id_to_update]["coefficient"] = updated_coefficient
        # Update the placeholder with the dictionary built from GUI labels and keys
        # Sort the placeholder dict by the numeric index of the placeholder key for consistent file output order
        # Although dict keys are ordered in modern Python, explicit sorting makes it robust
        sorted_placeholder_items = sorted(updated_placeholder_dict.items(),
                                          key=lambda item: int(re.match(r'\{(\d+)\}', item[0]).group(1)) if re.match(r'\{(\d+)\}', item[0]) else float('inf')) # Sort by {n} index

        # Reconstruct the dictionary to ensure sorted order before saving
        self.data[skill_id_to_update]["placeholder"] = dict(sorted_placeholder_items)


        self.data[skill_id_to_update]["cooldown"] = updated_cooldown
        self.data[skill_id_to_update]["costType"] = updated_cost_type
        self.data[skill_id_to_update]["cost"] = updated_cost
        self.data[skill_id_to_update]["range"] = updated_range

        # Note: filtered_skills refers to the original data loaded or last saved.
        # We are updating self.data, which is the source of truth.
        # No need to explicitly update filtered_skills here.


        # --- Save data back to file ---
        try:
            # Create a backup before saving
            backup_path = self.json_path + ".bak"
            if os.path.exists(self.json_path):
                try:
                    # Use shutil.copy2 to preserve metadata if possible, or os.replace for atomicity
                    os.replace(self.json_path, backup_path) # Rename original to .bak
                except OSError:
                     # Fallback to copy if os.replace fails (e.g., cross-filesystem)
                     import shutil # Ensure shutil is imported if it wasn't already (though it is in part 1)
                     shutil.copy2(self.json_path, backup_path)


            # Save the entire modified data dictionary back to the file
            with open(self.json_path, 'w', encoding='utf-8') as f:
                # Use indent for readability and ensure_ascii=False for Korean characters
                # json.dump will handle array formatting (single line or multi-line) based on its internal logic
                json.dump(self.data, f, indent=4, ensure_ascii=False)

            self.status_label.config(text=f"Successfully saved changes to {self.json_path}")
            messagebox.showinfo("Success", "Changes saved successfully!")

        except Exception as e:
            # If saving fails, try to restore backup
            error_message = f"Failed to save file: {e}"
            self.status_label.config(text=f"Save error: {e}")

            import shutil # Ensure shutil is imported

            if os.path.exists(backup_path):
                try:
                    # Attempt to restore the backup
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
# --- End of SkillEditorApp class definition ---

# Main execution block
if __name__ == "__main__":
    root = tk.Tk()
    app = SkillEditorApp(root)
    root.mainloop()