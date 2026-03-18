import { useState } from 'react'
import { AssignmentsTab } from './chore-admin/AssignmentsTab'
import { ChoresTab } from './chore-admin/ChoresTab'
import { PeopleTab } from './chore-admin/PeopleTab'

const tabs = ['Weekly Assignments', 'Manage Chores', 'People'] as const

export function ChoreAdmin() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Weekly Assignments')

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-bg-card rounded-lg p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-palette-1 text-white'
                : 'text-text-secondary hover:bg-bg-card-hover'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Weekly Assignments' && <AssignmentsTab />}
      {activeTab === 'Manage Chores' && <ChoresTab />}
      {activeTab === 'People' && <PeopleTab />}
    </div>
  )
}
