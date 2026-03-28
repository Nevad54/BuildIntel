# Directives

SOPs for the orchestration layer. Each file defines a task: its goal, inputs, which execution script to call, expected outputs, and known edge cases.

## How to write a directive

```
# Directive: <task name>

## Goal
What this task accomplishes.

## Inputs
- What data or parameters are required

## Execution
Which script(s) in `execution/` to run and in what order.

## Outputs
What gets produced (cloud deliverable or `.tmp/` intermediate).

## Edge cases & notes
Anything learned from running this in production.
```

Add one `.md` file per task.
