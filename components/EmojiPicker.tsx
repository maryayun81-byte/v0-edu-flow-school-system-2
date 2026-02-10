"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys & People",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "ww", "😖", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐"]
  },
  {
    name: "Animals & Nature",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "fox", "🐻", "🐼", "🐨", "🐯", "🦁", "cow", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "jg", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "horse", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "ant", "🦟", "🦗", "spider", "web", "scorpion", "turtle", "snake", "lizard", "t-rex", "sauropod", "octopus", "squid", "shrimp", "lobster", "crab", "puffer", "fish", "dolphin", "whale", "shark", "seal", "croc", "leopard", "zebra", "gorilla", "orangutan", "mammoth", "elephant", "hippo", "rhino", "camel", "llama", "giraffe", "buffalo", "ox", "bull", "cow", "pig", "ram", "sheep", "goat", "deer", "dog", "poodle", "cat", "rooster", "turkey", "peacock", "parrot", "swan", "flamingo", "dove", "rabbit", "raccoon", "badger", "mouse", "rat", "hamster", "chipmunk", "hedgehog", "bat", "bear", "koala", "panda", "sloth", "otter", "skunk", "kangaroo", "badger", "paw", "turkey", "chicken", "rooster", "hatching", "chick", "bird", "penguin", "dove", "eagle", "duck", "swan", "owl", "flamingo", "peacock", "parrot", "frog", "croc", "turtle", "lizard", "snake", "dragon", "sauropod", "t-rex"]
  },
  {
    name: "Food & Drink",
    emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "burrito", "🥗", "🥘", "🥫", "🍝", "🍜", "🍲", "🍛", "sushi", "bento", "dumpling", "oyster", "squid", "rice", "cracker", "fish_cake", "fortune_cookie", "moon_cake", "oden", "dango", "ice_cream", "shaved_ice", "ice_cream", "doughnut", "cookie", "cake", "cupcake", "pie", "chocolate", "candy", "lollipop", "custard", "honey", "milk", "tea", "sake", "champagne", "wine", "cocktail", "tropical_drink", "beer", "beers", "clinking_glasses", "cheers", "tumbler_glass", "cup_with_straw", "beverage_box", "mate", "ice", "chopsticks", "knife_fork_plate", "fork_knife", "spoon", "kitchen_knife", "amphora"]
  },
  {
     name: "Objects",
     emojis: ["⌚", "📱", "📲", "💻", "⌨", "🖥", "🖨", "🖱", "🖲", "🕹", "🗜", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽", "🎞", "📞", "☎", "Pager", "📠", "📺", "📻", "🎙", "🎚", "🎛", "🧭", "⏱", "⏲", "⏰", "🕰", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯", "🪔", "🧯", "🛢", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖", "🧰", "🔧", "🔨", "⚒", "🛠", "⛏", "🔩", "⚙", "🧱", "⛓", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡", "⚔", "🛡", "🚬", "⚰", "⚱", "🏺", "🔮", "📿", "🧿", "💈", "⚗", "🔭", "🔬", "🕳", "🩹", "🩺", "💊", "💉", "🩸", "🧬", "🦠", "🧫", "🧹", "🧺", "🧻", "🚽", "🚰", "🚿", "🛁", "🛀", "🧼", "🪒", "sponge", "lotion", "bell", "key", "🗝", "🚪", "chair", "couch", "bed", "teddy_bear", "doll", "frame", "mirror", "gem", "shopping_bags", "balloon", "flag", "ribbon", "confetti", "party_popper", "dolls", "lantern", "wind_chime", "envelope", "package", "postal_horn", "postbox", "mailbox", "scroll", "page", "newspaper", "bookmark", "tabs", "receipt", "chart", "trend", "calendar", "spiral_calendar", "card_index", "box", "ballot_box", "file_folder", "clipboard", "pushpin", "paperclip", "ruler", "triangular_ruler", "scissors", "card_file_box", "file_cabinet", "wastebasket", "locked", "unlocked", "pen", "fountain_pen", "pencil", "crayon", "paintbrush", "magnifying_glass", "search"]
  }
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
  return (
    <div className={cn("w-full max-w-xs h-64 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden", className)}>
      <div className="p-3 border-b border-white/5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emoji Picker</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {EMOJI_CATEGORIES.map((category) => (
            <div key={category.name}>
              <h4 className="px-2 text-[10px] font-medium text-muted-foreground mb-2 sticky top-0 bg-card/80 backdrop-blur-sm py-1 z-10 w-full">
                {category.name}
              </h4>
              <div className="grid grid-cols-8 gap-1">
                {category.emojis.map((emoji, index) => (
                  <button
                    key={`${emoji}-${index}`}
                    onClick={() => onSelect(emoji)}
                    className="aspect-square flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-transform hover:scale-110 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
