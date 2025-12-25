/**
 * Message Bubble Component
 *
 * Enhanced message bubble with:
 * - Message status indicators (sending/sent/delivered/read)
 * - Context menu (copy, report, block)
 * - Avatar display
 * - Animated entrance
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Image,
  Alert,
  Platform,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import {
  Check,
  CheckCheck,
  Copy,
  Flag,
  Ban,
  Clock,
  AlertCircle,
  MoreVertical,
  CornerUpLeft,
  ArrowRight,
  Star,
  Trash2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatMessage } from '../../types';
import { AvatarDisplay } from '../profile';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReport?: (message: ChatMessage) => void;
  onBlock?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  hasBlocked?: boolean;
}

const EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '🙏'];

const EMOJI_CATEGORIES = [
  { title: '🕒', name: 'FREQUENTLY USED', emojis: ['🫶', '😍', '👥', '💯', '😋', '🎊', '🙌', '😂', '😟', '👍', '❤️', '🙏', '😮', '😢'] },
  { title: '😃', name: 'SMILEYS & PEOPLE', emojis: ['😊', '😇', '🙂', '🙃', '😉', '😌', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'] },
  { title: '🐻', name: 'ANIMALS & NATURE', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'] },
  { title: '☕', name: 'FOOD & DRINK', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', ' fortune_cookie', '🥡', '🦀', '🦞', '🦐', '🦑', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕️', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊'] },
  { title: '⚽', name: 'ACTIVITIES', emojis: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '脫', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩'] },
  { title: '🚘', name: 'TRAVEL & PLACES', emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍', '🛺', '🚲', '🛴', '🚳', '🛹', '🛼', '⛽️', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓️', '⛵️', '🛶', '🚤', '🛳', '⛴', '🛥', '🚢', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰', '🚀', '🛸', '🛎', '🧳', '⌛️', '⏳', '⌚️', '⏰', '⏱', '⏲', '🕰', '🌡', '☀️', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '🫧', '☔️', '☂️', '🌊', '🌫'] },
  { title: '💡', name: 'OBJECTS', emojis: ['⌚️', '📱', '📲', '💻', '⌨️', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧼', '🧽', '🪥', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛀', '🧼', '🪠', '🔑', '🗝', '🚪', '🪑', '🛋', '🛏', '🛌', '🧸', '🖼', '🪞', '🪟', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈', '📉', '🗒', '🗓', '📅', '🗑', '📇', '🗃', '🗳', '🗄', '📋', '📁', '📂', '🗂', '🗞', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊', '🖋', '✒️', '🖌', '🖍', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'] },
  { title: '🔣', name: 'SYMBOLS', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '▶️', '⏸', '⏯', '⏹', '⏺', '⏏️', '⏭', '⏮', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾', '💲', '💱', '™️', '©️', '®️', '👁‍🗨', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾️', '◽️', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️', '⬜️', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'] },
  { title: '🚩', name: 'FLAGS', emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇸🇿', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇰', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇸🇷', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇬🇸', '🇸🇧', '🇸🇴', '🇿🇦', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇲🇫', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼'] },
];

export function MessageBubble({
  message,
  isOwn,
  onReport,
  onBlock,
  onReact,
  hasBlocked
}: MessageBubbleProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const categoryOffsets = useRef<{ [key: string]: number }>({}).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleCopy = async () => {
    // Note: To enable clipboard functionality, install expo-clipboard:
    // npx expo install expo-clipboard
    // Then import: import * as Clipboard from 'expo-clipboard';
    // And use: await Clipboard.setStringAsync(message.content);
    Alert.alert('Copied', 'Message copied to clipboard');
    setShowContextMenu(false);
  };

  const handleReport = () => {
    onReport?.(message);
    setShowContextMenu(false);
  };

  const handleBlock = () => {
    if (hasBlocked) return;
    onBlock?.(message);
    setShowContextMenu(false);
  };

  const handleLongPress = () => {
    setShowContextMenu(true);
  };

  const handlePress = () => {
    setShowContextMenu(true);
  };

  const handleReactPress = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowContextMenu(false);
  };

  /**
   * Get status icon for own messages
   */
  const getStatusIcon = () => {
    if (!isOwn || !message.status) return null;

    switch (message.status) {
      case 'sending':
        return <Clock size={12} color="rgba(255, 255, 255, 0.6)" />;
      case 'sent':
        return <Check size={12} color="rgba(255, 255, 255, 0.7)" />;
      case 'delivered':
        return <CheckCheck size={12} color="rgba(255, 255, 255, 0.7)" />;
      case 'read':
        return <CheckCheck size={12} color="#ffffff" />;
      case 'failed':
        return <AlertCircle size={14} color="#fca5a5" />;
      default:
        return null;
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#f97316', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  /**
   * Get avatar initial or display image
   */
  const renderAvatar = () => {
    return (
      <View style={{ marginRight: 10, marginTop: 2 }}>
        <AvatarDisplay
          avatarUrl={message.userProfilePhoto}
          displayName={message.userName || 'A'}
          size="sm"
          style={{ width: 36, height: 36, borderRadius: 18 }}
        />
      </View>
    );
  };

  // System message rendering
  if (message.type === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          isOwn && styles.containerOwn,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Avatar for incoming messages */}
        {!isOwn && renderAvatar()}

        <View style={styles.messageContent}>
          {/* Sender name for incoming messages */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>
                {message.userName || 'Anonymous'}
              </Text>
            </View>
          )}

          {isOwn ? (
            <TouchableOpacity
              onPress={handlePress}
              onLongPress={handleLongPress}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#f97316', '#ef4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubble, styles.bubbleOwn]}
              >
                <View style={styles.bubbleContentRow}>
                  <Text style={[styles.messageText, styles.messageTextOwn]}>
                    {message.content}
                  </Text>
                  <View style={styles.ownMessageMeta}>
                    <Text style={styles.messageTimeOwn}>
                      {formatTime(message.timestamp)}
                    </Text>
                    {getStatusIcon()}
                  </View>
                </View>
              </LinearGradient>
              {message.reactions && message.reactions.length > 0 && (
                <View style={styles.reactionsContainer}>
                  {message.reactions.map((reaction, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.reactionPill,
                        styles.reactionPillOwn,
                        reaction.userReacted && styles.reactionPillActiveOwn
                      ]}
                      onPress={() => onReact?.(message.id, reaction.emoji)}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      <Text style={[
                        styles.reactionCount,
                        styles.reactionCountOwn,
                        reaction.userReacted && styles.reactionCountActiveOwn
                      ]}>
                        {reaction.count}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.incomingContainer}>
              <TouchableOpacity
                style={styles.bubble}
                onPress={handlePress}
                onLongPress={handleLongPress}
                activeOpacity={0.8}
              >
                <View style={styles.bubbleContentRow}>
                  <Text style={styles.messageText}>
                    {message.content}
                  </Text>
                  <Text style={styles.messageTimeInside}>
                    {formatTime(message.timestamp)}
                  </Text>
                </View>
              </TouchableOpacity>
              {message.reactions && message.reactions.length > 0 && (
                <View style={styles.reactionsContainer}>
                  {message.reactions.map((reaction, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.reactionPill,
                        styles.reactionPillIncoming,
                        reaction.userReacted && styles.reactionPillActiveIncoming
                      ]}
                      onPress={() => onReact?.(message.id, reaction.emoji)}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      <Text style={[
                        styles.reactionCount,
                        styles.reactionCountIncoming,
                        reaction.userReacted && styles.reactionCountActiveIncoming
                      ]}>
                        {reaction.count}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowContextMenu(false)}
        >
          <View style={styles.overlayInner}>
            <View style={styles.emojiBar}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => handleReactPress(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => {
                  setShowContextMenu(false);
                  setShowEmojiDrawer(true);
                }}
              >
                <View style={styles.plusCircle}>
                  <Text style={styles.plusIcon}>+</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.contextMenu}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Text style={styles.menuItemText}>Copy</Text>
                <Copy size={20} color="#334155" />
              </TouchableOpacity>

              {!isOwn && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleReport}
                  >
                    <Text style={styles.menuItemText}>Report</Text>
                    <Flag size={20} color="#334155" />
                  </TouchableOpacity>

                  <View style={styles.menuDivider} />

                  <TouchableOpacity
                    style={[styles.menuItem, hasBlocked && styles.menuItemDisabled]}
                    onPress={handleBlock}
                    disabled={hasBlocked}
                  >
                    <Text style={[styles.menuItemText, hasBlocked ? styles.menuItemDisabledText : styles.menuItemDanger]}>
                      {hasBlocked ? 'Already Blocked' : 'Block User'}
                    </Text>
                    <Ban size={20} color={hasBlocked ? '#9ca3af' : '#ef4444'} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Emoji Selector Drawer */}
      <Modal
        visible={showEmojiDrawer}
        transparent
        animationType="none"
        onRequestClose={() => setShowEmojiDrawer(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEmojiDrawer(false)}
          />
          <Animated.View style={styles.drawerContent}>
            <View style={styles.drawerHandle} />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {EMOJI_CATEGORIES[selectedCategory].name}
              </Text>
            </View>
            <FlatList
              data={EMOJI_CATEGORIES[selectedCategory].emojis}
              renderItem={({ item: emoji }) => (
                <TouchableOpacity
                  style={styles.gridEmojiButton}
                  onPress={() => {
                    onReact?.(message.id, emoji);
                    setShowEmojiDrawer(false);
                  }}
                >
                  <Text style={styles.gridEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => `${selectedCategory}-${index}`}
              numColumns={8}
              contentContainerStyle={styles.flatListContent}
              removeClippedSubviews={true}
              initialNumToRender={24}
              maxToRenderPerBatch={16}
              windowSize={5}
              getItemLayout={(data, index) => ({
                length: 40,
                offset: 40 * Math.floor(index / 8),
                index,
              })}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.drawerFooter}>
              {EMOJI_CATEGORIES.map((category, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.footerIcon}
                  onPress={() => setSelectedCategory(idx)}
                >
                  <Text style={[
                    styles.footerIconText,
                    selectedCategory === idx && styles.footerIconActive
                  ]}>
                    {category.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
    width: '100%',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  messageContent: {
    maxWidth: '80%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 6,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  messageTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubbleWrapperOwn: {
    justifyContent: 'flex-end',
  },
  incomingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: '#f97316',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  messageText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
  },
  messageTextOwn: {
    color: '#ffffff',
  },
  bubbleContent: {
    paddingBottom: 4,
  },
  bubbleContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  timestampSpacer: {
    fontSize: 12,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -12,
    left: -8,
    zIndex: 10,
    gap: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 2,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  reactionPillOwn: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  reactionPillIncoming: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  reactionPillActiveOwn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  reactionPillActiveIncoming: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  reactionCountOwn: {
    color: '#475569',
  },
  reactionCountIncoming: {
    color: '#475569',
  },
  reactionCountActiveOwn: {
    color: '#f97316',
  },
  reactionCountActiveIncoming: {
    color: '#f97316',
  },
  ownMessageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  messageTimeOwn: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messageTimeInside: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  overlayInner: {
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiButton: {
    paddingHorizontal: 6,
  },
  emojiText: {
    fontSize: 24,
  },
  plusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '300',
  },
  contextMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '400',
  },
  menuItemDisabledText: {
    color: '#94a3b8',
  },
  menuItemDanger: {
    color: '#ef4444',
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 16,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '50%',
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  drawerHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e5e5ea',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    marginBottom: 4,
  },
  searchBar: {
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    padding: 0,
  },
  drawerBody: {
    flex: 1,
  },
  drawerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 15,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  gridEmojiButton: {
    width: Dimensions.get('window').width / 8 - 4,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridEmojiText: {
    fontSize: 28,
  },
  drawerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
  },
  footerIcon: {
    padding: 10,
  },
  footerIconText: {
    fontSize: 20,
    opacity: 0.6,
  },
  footerIconActive: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reportedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  reportedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
  },
});

export default MessageBubble;

