package org.example;

public class Branch {

    private final int id;
    private final int chatId;
    private final Integer parentBranchId;

    public Branch(
            int id,
            int chatId,
            Integer parentBranchId
    ) {
        this.id = id;
        this.chatId = chatId;
        this.parentBranchId = parentBranchId;
    }

    public int getId() {
        return id;
    }

    public int getChatId() {
        return chatId;
    }

    public Integer getParentBranchId() {
        return parentBranchId;
    }
}
