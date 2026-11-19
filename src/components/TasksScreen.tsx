import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import type { Task, TaskListType, Topic } from '../types';
import { millisecondsToHoursMinutes } from '../utils/time';
import { TopicShapeIcon } from './TopicShapeIcon';

interface TasksScreenProps {
  tasks: Task[];
  topics: Topic[];
  activeTaskId: string | null;
  onCreateTask: (title: string, estimatedMinutes: number, topicId: number, list: TaskListType) => void;
  onDeleteTask: (taskId: string) => void;
  onMoveTask: (taskId: string, list: TaskListType) => void;
  onCompleteTask: (taskId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onBlitzTask: (taskId: string) => void;
  hasCustomBg?: boolean;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({
  tasks,
  topics,
  activeTaskId,
  onCreateTask,
  onDeleteTask,
  onMoveTask,
  onCompleteTask,
  onAddSubtask,
  onToggleSubtask,
  onBlitzTask,
  hasCustomBg = false,
}) => {
  const [selectedList, setSelectedList] = useState<TaskListType>('today');
  const [title, setTitle] = useState('');
  const [estMinutes, setEstMinutes] = useState(25);
  const [topicId, setTopicId] = useState<number>(topics[0]?.id ?? 1);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtaskText, setSubtaskText] = useState('');

  const filteredTasks = tasks.filter((t) => t.list === selectedList);
  const totalEstMinutes = filteredTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateTask(
      trimmed,
      Math.max(1, estMinutes),
      topicId,
      selectedList === 'done' ? 'today' : selectedList
    );
    setTitle('');
  };

  const tabs: { id: TaskListType; label: string; count: number }[] = [
    { id: 'today', label: 'Today', count: tasks.filter((t) => t.list === 'today').length },
    { id: 'backlog', label: 'Backlog', count: tasks.filter((t) => t.list === 'backlog').length },
    { id: 'done', label: 'Done', count: tasks.filter((t) => t.list === 'done').length },
  ];

  return (
    <div
      className="min-h-screen pb-28 px-4"
      style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}
    >
      <div className="max-w-2xl mx-auto pt-6 space-y-4">
        <header className="text-center pb-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Tasks</h1>
          {selectedList !== 'done' && totalEstMinutes > 0 && (
            <p className="text-xs font-semibold mt-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Total estimated: {millisecondsToHoursMinutes(totalEstMinutes * 60000)}
            </p>
          )}
        </header>

        {/* Segmented List Tabs */}
        <div
          className="grid grid-cols-3 gap-1.5 p-1.5 rounded-full"
          style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
        >
          {tabs.map((tab) => {
            const active = selectedList === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedList(tab.id)}
                className="py-2 rounded-full text-sm font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--m3-primary)' : 'transparent',
                  color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                }}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Quick Add Form */}
        {selectedList !== 'done' && (
          <form
            onSubmit={handleAdd}
            className="rounded-[24px] p-4 space-y-3"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Add a task to ${selectedList === 'today' ? 'Today' : 'Backlog'}...`}
              className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium outline-none"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                color: 'var(--m3-on-surface)',
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                >
                  <Clock size={14} style={{ color: 'var(--m3-primary)' }} />
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={estMinutes}
                    onChange={(e) => setEstMinutes(Number(e.target.value))}
                    className="w-10 bg-transparent text-center font-bold tabular-nums outline-none"
                  />
                  <span>min</span>
                </label>

                <select
                  value={topicId}
                  onChange={(e) => setTopicId(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-surface-container-low)',
                    color: 'var(--m3-on-surface)',
                  }}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                <Plus size={15} />
                Add Task
              </button>
            </div>
          </form>
        )}

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div
            className="rounded-[24px] p-8 text-center text-sm font-medium"
            style={{
              backgroundColor: 'var(--m3-surface-bright)',
              color: 'var(--m3-on-surface-variant)',
            }}
          >
            {selectedList === 'today'
              ? 'No tasks for Today yet. Add one above and hit Blitz Now!'
              : selectedList === 'backlog'
                ? 'Your Backlog is empty.'
                : 'No completed tasks yet. Finish a task to celebrate!'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const topic = topics.find((t) => t.id === task.topicId) ?? topics[0];
              const isActive = activeTaskId === task.id;
              const isExpanded = expandedTaskId === task.id;
              const doneSubtasks = task.subtasks.filter((s) => s.done).length;

              return (
                <div
                  key={task.id}
                  className="rounded-[24px] p-4 space-y-3 transition-all"
                  style={{
                    backgroundColor: isActive
                      ? 'var(--m3-primary-container)'
                      : 'var(--m3-surface-bright)',
                    color: isActive ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          task.list === 'done'
                            ? onMoveTask(task.id, 'today')
                            : onCompleteTask(task.id)
                        }
                        className="mt-0.5 shrink-0 cursor-pointer"
                        aria-label={task.list === 'done' ? 'Reopen task' : 'Complete task'}
                      >
                        {task.list === 'done' ? (
                          <CheckCircle2 size={22} style={{ color: 'var(--m3-primary)' }} />
                        ) : (
                          <Circle size={22} style={{ color: 'var(--m3-outline)' }} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div
                          className={`font-bold text-sm sm:text-base ${
                            task.list === 'done' ? 'line-through opacity-70' : ''
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs opacity-80">
                          {topic && (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <TopicShapeIcon shape={topic.shape} color={topic.color} size={12} />
                              {topic.name}
                            </span>
                          )}
                          <span className="tabular-nums">Est. {task.estimatedMinutes}m</span>
                          {task.actualMs > 0 && (
                            <span className="tabular-nums font-semibold">
                              · Actual {millisecondsToHoursMinutes(task.actualMs)}
                            </span>
                          )}
                          {task.subtasks.length > 0 && (
                            <span>
                              · {doneSubtasks}/{task.subtasks.length} steps
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {task.list !== 'done' && (
                        <button
                          type="button"
                          onClick={() => onBlitzTask(task.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-transform active:scale-95"
                          style={{
                            backgroundColor: 'var(--m3-primary)',
                            color: 'var(--m3-on-primary)',
                          }}
                        >
                          <Zap size={13} fill="currentColor" />
                          Blitz
                        </button>
                      )}
                      {task.list === 'backlog' && (
                        <button
                          type="button"
                          onClick={() => onMoveTask(task.id, 'today')}
                          title="Move to Today"
                          className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                        >
                          <ArrowRight size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        title="Delete task"
                        className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                        style={{ color: 'var(--m3-error)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Subtasks Drawer */}
                  {isExpanded && (
                    <div className="pl-8 space-y-2 pt-1">
                      {task.subtasks.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onToggleSubtask(task.id, sub.id)}
                          className="w-full flex items-center gap-2 text-left text-xs font-medium py-1 cursor-pointer"
                        >
                          <span
                            className="w-4 h-4 rounded-md flex items-center justify-center border"
                            style={{
                              backgroundColor: sub.done ? 'var(--m3-primary)' : 'transparent',
                              borderColor: sub.done ? 'var(--m3-primary)' : 'var(--m3-outline)',
                              color: 'var(--m3-on-primary)',
                            }}
                          >
                            {sub.done && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className={sub.done ? 'line-through opacity-60' : ''}>
                            {sub.title}
                          </span>
                        </button>
                      ))}

                      {task.list !== 'done' && (
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={subtaskText}
                            onChange={(e) => setSubtaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && subtaskText.trim()) {
                                e.preventDefault();
                                onAddSubtask(task.id, subtaskText.trim());
                                setSubtaskText('');
                              }
                            }}
                            placeholder="Add a subtask..."
                            className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
                            style={{
                              backgroundColor: 'var(--m3-surface-container-low)',
                              color: 'var(--m3-on-surface)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!subtaskText.trim()) return;
                              onAddSubtask(task.id, subtaskText.trim());
                              setSubtaskText('');
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                            style={{
                              backgroundColor: 'var(--m3-secondary-container)',
                              color: 'var(--m3-on-secondary-container)',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
