import { getOtherUserAndGroup } from "@/lib/helper";
import { PROTECTED_ROUTES } from "@/routes/routes";
import type { ChatType } from "@/types/chat.type";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AvatarWithBadge from "../avatar-with-badge";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";

interface Props {
  chat: ChatType;
  currentUserId: string | null;
}

type typingData = {
  currentUserId: string;
  name: string;
};

type typingUsers = {
  typingUserId: string;
  typingUserName: string;
};

const ChatHeader = ({ chat, currentUserId }: Props) => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const { name, subheading, avatar, isOnline, isGroup } = getOtherUserAndGroup(
    chat,
    currentUserId
  );
  const [typingUsers, setTypingUsers] = useState<typingUsers[]>([]);

  useEffect(() => {
    if (!socket || !chat._id) return;
    const handleTyping = (data: typingData) => {
      setTypingUsers((prev) => {
        // 如果已经存在，则不要重复添加
        if (prev.some((u) => u.typingUserId === data.currentUserId)) {
          return prev;
        }
        return [
          ...prev,
          {
            typingUserId: data.currentUserId,
            typingUserName: data.name,
          },
        ];
      });
    };

    const handleStopTyping = (data: typingData) => {
      setTypingUsers((prev) =>
        prev.filter((u) => u.typingUserId !== data.currentUserId)
      );
    };
    // 绑定事件
    socket.on("typing:msg", handleTyping);
    socket.on("stopTyping:msg", handleStopTyping);
    return () => {
      socket.off("typing:msg", handleTyping);
      socket.off("stopTyping:msg", handleStopTyping);
    };
  }, [socket, chat._id]);

  return (
    <div
      className="sticky top-0
    flex items-center gap-5 border-b border-border
    bg-card px-2 z-50
    "
    >
      <div className="h-14 px-4 flex items-center">
        <div>
          <ArrowLeft
            className="w-5 h-5 inline-block lg:hidden
          text-muted-foreground cursor-pointer
          mr-2
          "
            onClick={() => navigate(PROTECTED_ROUTES.CHAT)}
          />
        </div>
        <AvatarWithBadge
          name={name}
          src={avatar}
          isGroup={isGroup}
          isOnline={isOnline}
        />
        <div className="ml-2">
          <h5 className="font-semibold">{name}</h5>
          <p
            className={`text-sm ${
              isOnline ? "text-green-500" : "text-muted-foreground"
            }`}
          >
            {subheading}
          </p>
        </div>
      </div>
      <div>
        <div
          className={`flex-1
            text-center
            py-4 h-full
            border-b-2
            border-primary
            font-medium
            text-primary`}
        >
          Chat
        </div>
      </div>
      <div>
        {typingUsers.length > 0 && (
          <>
            <div>someone is typing...</div>
            {typingUsers.map((user) => (
              <span className="mr-2" key={user.typingUserId}>
                {user.typingUserName}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
