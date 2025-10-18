import React, { useState } from "react";
import { useSocket } from "../../contexts/SocketContext";
import { Palette } from "lucide-react";

export default function CollaborationPanel() {
  const { isConnected, currentRoom, users, joinRoom } = useSocket();
  const [roomInput, setRoomInput] = useState("");

  const handleJoinRoom = () => {
    if (roomInput.trim()) {
      joinRoom(currentRoom, roomInput.trim());
      setRoomInput("");
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-white border-2 border-blue-400 rounded-lg shadow-2xl p-6 min-w-64 z-50">
      <h3 className="font-bold text-lg mb-4 text-blue-600 flex items-center gap-2">
        <Palette className="w-5 h-5" />
        <span>Collaboration</span>
      </h3>

      <div className="mb-3">
        <div
          className={`inline-block w-2 h-2 rounded-full mr-2 ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        ></div>
        <span className="text-sm text-black">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter room ID (e.g. my-room-123)"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg mb-2 text-black focus:border-blue-500 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
        />
        <button
          onClick={handleJoinRoom}
          disabled={!isConnected || !roomInput.trim()}
          className="w-full px-3 py-2 font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Join Room
        </button>
      </div>

      {currentRoom && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-black mb-1">
            Current Room: <span className="font-mono">{currentRoom}</span>
          </div>
          <div className="text-xs text-black">
            {users.length} user{users.length !== 1 ? "s" : ""} connected
          </div>
          {users.length > 0 && (
            <div className="mt-2 space-y-1">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="text-xs bg-white px-2 py-1 rounded border text-black"
                >
                  User {user.id.substring(0, 6)}...
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
