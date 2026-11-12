# Confirmed bookmark deletion design

User approved deletion inside the existing edit dialog followed by explicit confirmation. Confirmation shows bookmark name and URL, explains that the original Chrome bookmark is deleted, and focuses Cancel by default. Only that bookmark ID is removed; duplicate URLs remain. No bulk/folder deletion or new permission. Cancellation does not mutate data. Failure retains the confirmation and bookmark, with an error and retry. Successful deletion refreshes the grid; existing onRemoved worker cleanup removes aliases and usage/pin records.

## Approaches
A direct hover delete button crowds the compact grid. The user selected an edit-dialog entry with a second confirmation for clarity and minimal grid impact. No app-level undo promise because this removes the original bookmark.
