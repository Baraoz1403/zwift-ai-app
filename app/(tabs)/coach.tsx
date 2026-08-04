/**
 * Coach screen — free chat with the AI coach.
 *
 * The coach has full context:
 *  - athlete profile
 *  - current plan
 *  - training load
 *  - past feedback
 *
 * Use cases:
 *  - "Why did you schedule Norwegian 4×4 this week?"
 *  - "I'm feeling sick — what should I do?"
 *  - "Can you adjust Thursday's workout?"
 *  - "Explain sweet spot training"
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../_layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'coach';
  text: string;
  timestamp: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'coach',
      text: "Hey! I'm your AI coach. I know your current plan, your training load, and your history. Ask me anything — why I scheduled a specific workout, how to adjust if you're tired, or anything about your training.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      // TODO: call /api/coach/chat with full context
      // const res = await fetch('/api/coach/chat', {
      //   method: 'POST',
      //   body: JSON.stringify({ message: text, athleteId, history: messages }),
      // });
      // const data = await res.json();

      // Stub response
      await new Promise(r => setTimeout(r, 800));
      const coachMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'coach',
        text: `Good question. I'll have a full answer once the OpenAI integration is wired up. The coaching engine is ready — we just need to connect this chat to it.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, coachMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'coach',
        text: 'Sorry, I had trouble responding. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.screenTitle}>Coach</Text>
        <View style={s.statusDot} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <Bubble message={item} />}
        contentContainerStyle={s.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* Quick prompts (shown only at start) */}
      {messages.length === 1 && (
        <QuickPrompts onSelect={text => { setInput(text); }} />
      )}

      {/* Input bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach..."
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[s.sendButton, (!input.trim() || sending) && s.sendDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          activeOpacity={0.7}
        >
          {sending
            ? <ActivityIndicator size="small" color={COLORS.text} />
            : <Text style={s.sendIcon}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ message }: { message: Message }) {
  const isCoach = message.role === 'coach';
  return (
    <View style={[s.bubble, isCoach ? s.bubbleCoach : s.bubbleUser]}>
      {isCoach && <Text style={s.bubbleLabel}>Coach</Text>}
      <Text style={[s.bubbleText, isCoach ? s.bubbleTextCoach : s.bubbleTextUser]}>
        {message.text}
      </Text>
      <Text style={s.bubbleTime}>
        {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "Why did you schedule this week's hard sessions on those days?",
  "I'm feeling tired — should I adjust today?",
  "Explain what sweet spot training does for me",
  "How long until I'm ready for Norwegian 4×4?",
];

function QuickPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <View style={s.quickContainer}>
      {QUICK_PROMPTS.map(p => (
        <TouchableOpacity key={p} style={s.quickChip} onPress={() => onSelect(p)} activeOpacity={0.7}>
          <Text style={s.quickText}>{p}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },

  messages: { paddingHorizontal: 16, paddingBottom: 12 },

  bubble: { marginBottom: 12, maxWidth: '85%', borderRadius: 16, padding: 14 },
  bubbleCoach: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
  bubbleUser:  { alignSelf: 'flex-end',   backgroundColor: COLORS.accent,  borderBottomRightRadius: 4 },
  bubbleLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextCoach: { color: COLORS.text },
  bubbleTextUser:  { color: COLORS.text },
  bubbleTime: { fontSize: 10, color: COLORS.muted, marginTop: 6, alignSelf: 'flex-end' },

  quickContainer: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  quickChip: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  quickText: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },

  inputBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  input: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: COLORS.text, maxHeight: 120, borderWidth: 1, borderColor: COLORS.border },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 20, color: COLORS.text, fontWeight: '700' },
});
