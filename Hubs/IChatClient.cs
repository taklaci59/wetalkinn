namespace DoWeTalk.Hubs
{
    public interface IChatClient
    {
        Task ReceiveMessage(string sender, string content, string time);
        Task ReceiveCall(string caller);
        Task CallAccepted(string acceptor);
        Task ReceiveOffer(string sender, object offer);
        Task ReceiveAnswer(string sender, object answer);
        Task ReceiveIceCandidate(string sender, object candidate);
        Task CallEnded(string sender);
        Task ReceiveMediaStatus(string sender, bool micMuted, bool deafened);
        Task ReceiveFriendRequest(string sender);
        Task ReceivePrivateMessage(string sender, string receiver, string message, string time);
        Task ReceiveTypingStatus(string sender, bool isTyping);
        Task UserStatusChanged(string username, bool isOnline);
    }
}
