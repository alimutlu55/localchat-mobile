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
import { theme } from '../../core/theme';
import { ChatMessage } from '../../types';
import { AvatarDisplay } from '../profile';
import { useRealtimeProfile } from '../../features/user/hooks/useRealtimeProfile';
import { getCategoryColor } from '../../constants';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReport?: (message: ChatMessage) => void;
  onBlock?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (message: ChatMessage) => void;
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
  onRetry,
  hasBlocked
}: MessageBubbleProps) {
  // Use real-time profile for sender info
  const profile = useRealtimeProfile({
    userId: message.userId,
    displayName: message.userName || 'Anonymous',
    profilePhotoUrl: message.userProfilePhoto,
  });

  const userName = profile.displayName;
  const userProfilePhoto = profile.profilePhotoUrl;

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
        return <Clock size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.6 }} />;
      case 'sent':
        return <Check size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.7 }} />;
      case 'delivered':
        return <CheckCheck size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.7 }} />;
      case 'read':
        return <CheckCheck size={12} color={theme.tokens.text.onPrimary} />;
      case 'failed':
        return null; // We'll handle failed state separately with tap-to-retry
      default:
        return null;
    }
  };

  /**
   * Handle retry for failed messages
   */
  const handleRetry = () => {
    if (message.status === 'failed' && onRetry) {
      onRetry(message);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      getCategoryColor('FOOD_DINING'),
      getCategoryColor('EVENTS_FESTIVALS'),
      getCategoryColor('SPORTS_FITNESS'),
      getCategoryColor('TRAFFIC_TRANSIT'),
      getCategoryColor('GENERAL'),
    ];
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
          avatarUrl={userProfilePhoto}
          displayName={userName}
          size="sm"
          style={{ width: 32, height: 32, borderRadius: 16 }}
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
                {userName}
              </Text>
            </View>
          )}

          {isOwn ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={message.status === 'failed' ? handleRetry : handlePress}
                  onLongPress={message.status === 'failed' ? undefined : handleLongPress}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      message.status === 'failed'
                        ? [theme.tokens.status.error.main, theme.tokens.status.error.main]
                        : [theme.tokens.brand.primary, theme.tokens.brand.secondary]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.bubble,
                      styles.bubbleOwn,
                      message.status === 'failed' && styles.bubbleFailed,
                      message.reactions && message.reactions.length > 0 && { marginBottom: 12 },
                    ]}
                  >
                    <View style={styles.bubbleInner}>
                      <Text style={[styles.messageText, styles.messageTextOwn]}>
                        {message.content}
                        <View style={{ width: 68, height: 1 }} />
                      </Text>
                      <View style={styles.ownMessageMetaAbsolute}>
                        {message.status === 'failed' ? (
                          <AlertCircle size={14} color={theme.tokens.text.onPrimary} />
                        ) : (
                          <>
                            <Text style={styles.messageTimeOwn}>
                              {formatTime(message.timestamp)}
                            </Text>
                            {getStatusIcon()}
                          </>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                {message.reactions && message.reactions.length > 0 && (
                  <View style={[styles.reactionsContainer, styles.reactionsContainerOwn]}>
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
              </View>
              {/* Failed message retry hint */}
              {message.status === 'failed' && (
                <TouchableOpacity
                  style={styles.retryHint}
                  onPress={handleRetry}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AlertCircle size={12} color={theme.tokens.text.error} />
                  <Text style={styles.retryHintText}>Tap to retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'flex-start' }}>
              <View style={{ position: 'relative' }}>
                <View style={styles.incomingContainer}>
                  <TouchableOpacity
                    style={[
                      styles.bubble,
                      message.reactions && message.reactions.length > 0 && { marginBottom: 12 },
                      styles.bubbleIncoming
                    ]}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    activeOpacity={0.8}
                  >
                    <View style={styles.bubbleInner}>
                      <Text style={styles.messageText}>
                        {message.content}
                        <View style={{ width: 55, height: 1 }} />
                      </Text>
                      <View style={styles.messageMetaAbsolute}>
                        <Text style={styles.messageTimeInside}>
                          {formatTime(message.timestamp)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
                {message.reactions && message.reactions.length > 0 && (
                  <View style={[styles.reactionsContainer, styles.reactionsContainerIncoming]}>
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
            </View>
          )}
        </View>
      </Animated.View >

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
                <Copy size={20} color={theme.tokens.text.primary} />
              </TouchableOpacity>

              {!isOwn && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleReport}
                  >
                    <Text style={styles.menuItemText}>Report</Text>
                    <Flag size={20} color={theme.tokens.text.primary} />
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
                    <Ban size={20} color={hasBlocked ? theme.tokens.text.tertiary : theme.tokens.text.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Modal >

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
      </Modal >
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.tokens.text.onPrimary,
  },
  messageContent: {
    maxWidth: '80%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
    gap: 6,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.tokens.text.primary,
  },
  messageTime: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
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
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    shadowColor: theme.tokens.border.strong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: theme.tokens.action.primary.default,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  bubbleFailed: {
    opacity: 0.8,
  },
  retryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingRight: 4,
  },
  retryHintText: {
    fontSize: 12,
    color: theme.tokens.text.error,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 15,
    color: theme.tokens.text.primary,
    lineHeight: 20,
    flexShrink: 1,
  },
  messageTextOwn: {
    color: theme.tokens.text.onPrimary,
  },
  bubbleInner: {
    flexDirection: 'column',
    position: 'relative',
  },
  bubbleIncoming: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 10,
  },
  ownMessageMetaAbsolute: {
    position: 'absolute',
    bottom: 2,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageMetaAbsolute: {
    position: 'absolute',
    bottom: 2,
    right: 8,
  },
  messageTimeOwn: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeInside: {
    fontSize: 11,
    color: theme.tokens.text.tertiary,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -8,
    gap: 4,
    zIndex: 10,
  },
  reactionsContainerOwn: {
    right: 4,
  },
  reactionsContainerIncoming: {
    left: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    height: 20,
    borderRadius: 10,
    gap: 2,
    borderWidth: 0,
  },
  reactionPillOwn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  reactionPillIncoming: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  reactionPillActiveOwn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  reactionPillActiveIncoming: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  reactionCountOwn: {
    color: theme.tokens.text.secondary,
  },
  reactionCountIncoming: {
    color: theme.tokens.text.secondary,
  },
  reactionCountActiveOwn: {
    color: theme.tokens.text.secondary,
  },
  reactionCountActiveIncoming: {
    color: theme.tokens.text.secondary,
  },
  overlayInner: {
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
  },
  emojiBar: {
    flexDirection: 'row',
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: theme.tokens.border.strong,
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
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: theme.tokens.text.secondary,
    fontSize: 18,
    fontWeight: '300',
  },
  contextMenu: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
    shadowColor: theme.tokens.border.strong,
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
    fontSize: 15,
    color: theme.tokens.text.primary,
    fontWeight: '400',
  },
  menuItemDisabledText: {
    color: theme.tokens.text.tertiary,
  },
  menuItemDanger: {
    color: theme.tokens.text.error,
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: theme.tokens.border.subtle,
    marginHorizontal: 16,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    backgroundColor: theme.tokens.bg.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '50%',
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  drawerHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.tokens.border.strong,
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
    backgroundColor: theme.tokens.bg.surface,
    paddingVertical: 8,
    marginBottom: 4,
  },
  searchBar: {
    backgroundColor: theme.tokens.bg.canvas,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.tokens.text.primary,
    padding: 0,
  },
  drawerBody: {
    flex: 1,
  },
  drawerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: theme.tokens.text.tertiary,
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
    borderTopColor: theme.tokens.border.subtle,
    backgroundColor: theme.tokens.bg.surface,
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
    color: theme.tokens.text.tertiary,
    backgroundColor: theme.tokens.bg.subtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reportedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    backgroundColor: theme.tokens.status.error.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
  },
  reportedText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.tokens.text.error,
    textTransform: 'uppercase',
  },
});

export default MessageBubble;

