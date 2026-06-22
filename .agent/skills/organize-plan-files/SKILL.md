---
name: organize-plan-files
description: Organize plan files in `.cursor/plans` directory.

Use when user asks to organize plan files.
---

1. Check for loose files in `.cursor/plans` directory (i.e., not in a feature subdirectory)
2. Find our creation time of the file.
3. Prepend the file name with creation time in "YYYY-MM-DDThh-mm-ss-" format so it becomes sorted.
4. Without checking the file content, categorize the file by its feature. Move the files to feature subdirectory. For example, if a file plans for playlist related functionalities, move it to `playlist` sub-directory.

5. Do the above steps for all loose files in the `.cursor/plans` directory.
