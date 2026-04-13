---
name: alloomi-event-creator
description: Guide users through creating and managing tracking events in Alloomi. Use when users want to create, edit, or manage tracking events (e.g., "帮我创建一个追踪", "I want to track competitor updates", "create a project progress tracking"). This skill provides conversational guidance to help users complete event creation through the Alloomi interface.
metadata:
  version: 0.4.0
---

# Alloomi Event Creator

This skill guides users through creating and managing tracking events in Alloomi through conversational interaction. The goal is to help users create effective tracking events by asking the right questions and guiding them through the Alloomi interface.

## Trigger Recognition

Activate this skill when users express intent to:
- Create a new tracking event
- Manage existing tracking events
- Set up monitoring for something
- Track progress of projects/goals

Common trigger phrases:
- "帮我创建一个追踪提醒我喝水" / "Create a tracking for me and remind me to drink water"
- "我想追踪..." / "I want to track..."
- "创建一个事件" / "create an event"
- "添加一个监控" / "add a monitor"
- "设置提醒" / "set a reminder"

## Core Conversation Flow

### Step 1: Identify the tracking event type

When a user wants to create a tracking event, first understand what they want to track. Ask open-ended questions:

```
What would you like to track? Tell me about it:
- Project progress (e.g., product launch plan)
- Personal goals (e.g., exercise 3 times a week)
- Competitor updates (e.g., Competitor A's feature updates)
- Customer follow-up (e.g., Client A's purchasing process)
- Meeting records
- Other things you care about
```

### Step 2: Gather Required Information

For each tracking event, guide the user to provide these essential fields:

| Field | Description | Required | Guided Phrasing |
|-------|-------------|:--------:|-----------------|
| Title | Short description of the event | ✓ | "Give your tracking a name, like..." |
| Description | Detailed explanation of what to track | ✓ | "Please describe what you want to track in detail" |
| Category | Event priority | - | "What's the priority for this tracking? (Urgent/Important/Monitor/Archive)" |

### Step 3: Suggest Optional Fields

After collecting required fields, suggest optional enhancements:

| Field | Description | Guided Phrasing |
|-------|-------------|-----------------|
| Related People | Associated personnel | "Do you need to link any related people?" |
| Timeline | Important milestones | "Are there any important dates to record?" |
| Todo Items | Tasks to complete | "Would you like to add any todo items?" |

### Step 4: Guide to Alloomi Interface

After collecting information, guide the user to complete the creation in Alloomi:

```
Great, I've gathered your requirements:
- Title: [user's title]
- Description: [user's description]
- Category: [user's category]

Now please complete the following in Alloomi:
1. Open the Alloomi app
2. Click the "Create" button
3. Select "tracking event" type
4. Fill in the information above
5. Save

Would you like me to help you organize this into a more detailed description?
```

## Event Type Examples

### Project Progress tracking event

```
User: I want to track product launch progress

AI: Sure, which product's launch plan is this?
User: It's our company's new app

AI: Please tell me the key information for this launch plan:
1. Title: New App Product Launch
2. Description: Track iOS and Android version development, testing, and launch progress
3. Category: Important
4. Timeline:
   - Beta testing: March 20
   - Official launch: April 1
5. Todo Items:
   - Complete UI acceptance
   - Submit to App Store review

Is this enough, or do you need to add more details?
```

### Competitor Monitoring

```
User: I want to monitor competitor feature updates

AI: Sure, which product's updates do you want to monitor? (e.g., Competitor A, Competitor B, or a specific product name)

User: Monitor ByteDance's AI products

AI: Great, what aspects of updates would you like to follow?
- New feature launches
- Price changes
- User reviews
- Other

Please tell me what you'd like to monitor, and I'll help you organize it into a complete tracking description.
```

### Personal Goal tracking event

```
User: I want to build a daily exercise habit

AI: Excellent! Please tell me:
1. What's your goal? (e.g., exercise 3 times a week, run 30 minutes daily)
2. Any incentive mechanisms?
3. Do you need reminders?

Tell me your goal, and I'll help you create a tracking for it.
```

## Handling Incomplete Information

When users provide insufficient details, guide them to supplement:

### Missing Title

```
User: Help me create a tracking, I want to track project progress

AI: Sure, what's the title for this tracking? For example:
- "Product Launch Progress tracking event"
- "Q2 Feature Development Monitoring"
- "Client A Project Follow-up"
```

### Missing Description

```
User: I want to create a tracking for an important project

AI: Please tell me more about this project:
- What is this project about?
- What aspects need to be monitored?
- Are there any key milestones or checkpoints?
```

### Missing Category

```
User: Help me create a tracking, title is "New Product Launch"

AI: What's the priority for this tracking?
- 🔴 Urgent - Needs immediate attention
- 🟡 Important - Needs regular follow-up
- 🔵 Monitor - Worth watching but not frequent

I'll mark it as "Important", is that okay?
```

## Post-Creation Support

After helping users create a tracking event, offer continued support:

```
After your tracking event is created, you can:
- View and update progress anytime in Alloomi
- Add timeline events to record important milestones
- Add todo items to track tasks
- Set reminders to ensure you don't miss important checkpoints
- Drag to reorder tracking events and adjust their priority on the page
- Click "No Longer Follow" when you want to stop tracking something

Would you like me to help you set reminders? Or add other information?
```

### Managing Existing tracking events

After creating a tracking event, users can manage it in several ways:

**Adjust Priority by Dragging:**
- In the Alloomi interface, you can drag tracking events to reorder them
- This changes the display order on the page based on your preference
- More important items can be moved to the top for easier access

**Stop Following a tracking event:**
- When you no longer need to track something, click the "No Longer Follow" button
- This removes the tracking event from your active list
- The data is preserved in case you want to follow it again later

```
User: I don't want to track this anymore

AI: No problem! In Alloomi, you can:
1. Find the tracking event you want to stop following
2. Click the "No Longer Follow" button
3. Confirm the action

The tracking event will be archived and you can always reactivate it later if needed.
```

## Summary

This skill focuses on:
1. **Conversational guidance** - Lead users through questions to gather required information
2. **Flexible type support** - Adapt to different tracking needs (projects, habits, monitoring, etc.)
3. **Interface guidance** - Direct users to complete actions in Alloomi
4. **Iterative refinement** - Help users supplement missing information through follow-up questions

Remember: This skill guides users on HOW to create tracking events through conversation, then directs them to complete the actual creation in the Alloomi interface.
