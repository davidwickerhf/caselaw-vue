<script setup lang="ts">
import { Plus, Trash2, Brackets, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { QueryBuilderGroup, QueryBuilderRule, SourceScope } from '~/lib/types'
import {
  QUERY_BUILDER_FIELDS_BY_SCOPE,
  QUERY_BUILDER_OPERATORS,
  defaultFieldForScope,
  defaultScopeForField,
  isFieldAllowed
} from '~/lib/utils/query-builder-config'

const SOURCE_SCOPES: { value: SourceScope; label: string }[] = [
  { value: 'ANY', label: 'Any' },
  { value: 'ECHR', label: 'ECHR' },
  { value: 'RS', label: 'Rechtspraak' }
]

const props = defineProps<{
  group: QueryBuilderGroup
  parent: QueryBuilderGroup | null
  depth: number
}>()

const emit = defineEmits<{
  removeGroup: [groupId: string]
  change: []
}>()

const prevScopeByRule = new Map<string, SourceScope>()

props.group.rules.forEach((rule) => {
  if (!rule.sourceScope) rule.sourceScope = defaultScopeForField(rule.field)
  if (!isFieldAllowed(rule.sourceScope, rule.field)) {
    const nextScope = defaultScopeForField(rule.field)
    rule.sourceScope = nextScope
    if (!isFieldAllowed(nextScope, rule.field)) {
      rule.field = defaultFieldForScope(nextScope)
    }
  }
  prevScopeByRule.set(rule.id, rule.sourceScope as SourceScope)
})

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function newRule(): QueryBuilderRule {
  return { id: genId(), field: 'text', operator: 'contains', value: '', sourceScope: 'ANY' }
}

function addRule(group: QueryBuilderGroup) {
  const rule = newRule()
  group.rules.push(rule)
  prevScopeByRule.set(rule.id, rule.sourceScope as SourceScope)
  emit('change')
}

function removeRule(group: QueryBuilderGroup, ruleId: string) {
  group.rules = group.rules.filter((r) => r.id !== ruleId)
  emit('change')
}

function addSubGroup(group: QueryBuilderGroup) {
  group.groups.push({ id: genId(), operator: 'OR', rules: [newRule()], groups: [] })
  emit('change')
}

function removeSubGroup(parent: QueryBuilderGroup, groupId: string) {
  parent.groups = parent.groups.filter((g) => g.id !== groupId)
  emit('change')
}

function onFieldChange(rule: QueryBuilderRule) {
  const ops = QUERY_BUILDER_OPERATORS[rule.field]
  if (ops && ops.length > 0) rule.operator = ops[0].value
  enforceAndScopeConsistency(rule.id)
  emit('change')
}

function onValueChange() {
  emit('change')
}

function onScopeChange(rule: QueryBuilderRule) {
  const previous = prevScopeByRule.get(rule.id) || defaultScopeForField(rule.field)
  if (!isFieldAllowed(rule.sourceScope, rule.field)) {
    rule.field = defaultFieldForScope(rule.sourceScope)
  }
  const ops = QUERY_BUILDER_OPERATORS[rule.field]
  if (ops && ops.length > 0) rule.operator = ops[0].value
  if (!enforceAndScopeConsistency(rule.id, previous)) {
    rule.sourceScope = previous
    return
  }
  prevScopeByRule.set(rule.id, rule.sourceScope)
  emit('change')
}

function onOperatorChange(group: QueryBuilderGroup, op: string) {
  const prev = group.operator
  group.operator = op as 'AND' | 'OR' | 'NOT'
  if (group.operator === 'AND' && hasScopeConflict(group)) {
    group.operator = prev
    toast.error('AND groups cannot mix ECHR and Rechtspraak rules. Use OR grouping instead.', { duration: 2400 })
    return
  }
  emit('change')
}

function getRuleScope(rule: QueryBuilderRule): SourceScope {
  const raw = (rule.sourceScope || defaultScopeForField(rule.field)) as SourceScope
  return isFieldAllowed(raw, rule.field) ? raw : defaultScopeForField(rule.field)
}

function getGroupScopes(group: QueryBuilderGroup, excludeRuleId?: string): SourceScope[] {
  const scopes: SourceScope[] = []
  for (const rule of group.rules) {
    if (excludeRuleId && rule.id === excludeRuleId) continue
    const scope = getRuleScope(rule)
    if (scope !== 'ANY') scopes.push(scope)
  }
  return Array.from(new Set(scopes))
}

function hasScopeConflict(group: QueryBuilderGroup): boolean {
  const scopes = getGroupScopes(group)
  return scopes.length > 1
}

function enforceAndScopeConsistency(ruleId?: string, previous?: SourceScope): boolean {
  if (props.group.operator !== 'AND') return true
  const scopes = getGroupScopes(props.group, ruleId)
  if (scopes.length > 1) {
    toast.error('AND groups cannot mix ECHR and Rechtspraak rules. Use OR grouping instead.', { duration: 2400 })
    return false
  }
  const locked = scopes[0]
  if (!locked) return true
  const rule = props.group.rules.find((r) => r.id === ruleId)
  if (!rule) return true
  const nextScope = getRuleScope(rule)
  if (nextScope !== 'ANY' && nextScope !== locked) {
    toast.error('AND groups must use Any or a single dataset scope.', { duration: 2200 })
    if (previous) rule.sourceScope = previous
    return false
  }
  return true
}

function scopeOptions(rule: QueryBuilderRule) {
  if (props.group.operator !== 'AND') return SOURCE_SCOPES
  const scopes = getGroupScopes(props.group, rule.id)
  if (scopes.length === 0) return SOURCE_SCOPES
  const locked = scopes[0]
  return SOURCE_SCOPES.filter((s) => s.value === 'ANY' || s.value === locked)
}
</script>

<template>
  <div :class="['rounded-lg border p-3.5', depth > 0 ? 'ml-4 border-border/40 bg-muted/20' : 'border-border/50']">
    <!-- Group operator -->
    <div class="flex items-center gap-2 mb-3">
      <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Match</span>
      <div class="flex rounded-lg border border-border/50 overflow-hidden">
        <button
          v-for="op in ['AND', 'OR', 'NOT']"
          :key="op"
          :class="[
            'px-3 py-1 text-[11px] font-semibold tracking-wide transition-all',
            group.operator === op
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          ]"
          @click="onOperatorChange(group, op)"
        >
          {{ op }}
        </button>
      </div>
      <span class="text-[10px] text-muted-foreground/50">of the following</span>
    </div>
    <div
      v-if="group.operator === 'AND' && hasScopeConflict(group)"
      class="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive/80"
    >
      <AlertCircle class="h-3.5 w-3.5" />
      This AND group mixes ECHR and Rechtspraak rules. Use OR grouping to combine datasets.
    </div>

    <!-- Rules -->
    <div class="space-y-2">
      <div v-for="rule in group.rules" :key="rule.id" class="flex items-center gap-2">
        <select
          v-model="rule.sourceScope"
          class="h-8 rounded-lg border border-border/50 bg-background px-2 text-[11px] font-semibold uppercase tracking-wide text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          @change="onScopeChange(rule)"
        >
          <option v-for="scope in scopeOptions(rule)" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
        </select>
        <select
          v-model="rule.field"
          class="h-8 rounded-lg border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          @change="onFieldChange(rule)"
        >
          <option
            v-for="field in QUERY_BUILDER_FIELDS_BY_SCOPE[rule.sourceScope]"
            :key="field.value"
            :value="field.value"
          >
            {{ field.label }}
          </option>
        </select>
        <select
          v-model="rule.operator"
          class="h-8 rounded-lg border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          @change="onValueChange"
        >
          <option
            v-for="op in (QUERY_BUILDER_OPERATORS[rule.field] || [])"
            :key="op.value"
            :value="op.value"
          >
            {{ op.label }}
          </option>
        </select>
        <input
          type="text"
          v-model="rule.value"
          placeholder="value..."
          class="h-8 flex-1 rounded-lg border border-border/50 bg-background px-2.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          @input="onValueChange"
        />
        <button
          class="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-30 disabled:pointer-events-none"
          :disabled="group.rules.length <= 1"
          @click="removeRule(group, rule.id)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Sub-groups (recursive) -->
    <div v-if="group.groups.length > 0" class="mt-3 space-y-3">
      <QueryBuilderGroup
        v-for="subGroup in group.groups"
        :key="subGroup.id"
        :group="subGroup"
        :parent="group"
        :depth="depth + 1"
        @remove-group="removeSubGroup(group, $event)"
        @change="emit('change')"
      />
    </div>

    <!-- Actions -->
    <div class="flex gap-1.5 mt-3 pt-2 border-t border-border/30">
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
        @click="addRule(group)"
      >
        <Plus class="h-3 w-3" /> Add rule
      </button>
      <button
        v-if="depth === 0"
        class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
        @click="addSubGroup(group)"
      >
        <Brackets class="h-3 w-3" /> Add group
      </button>
      <button
        v-if="parent"
        class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all ml-auto"
        @click="emit('removeGroup', group.id)"
      >
        <Trash2 class="h-3 w-3" /> Remove group
      </button>
    </div>
  </div>
</template>
