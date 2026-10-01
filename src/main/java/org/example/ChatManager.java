package org.example;

import java.sql.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ChatManager {

    public int createChat(String title) {

        String sql = """
                INSERT INTO chats (title)
                VALUES (?)
                RETURNING id
                """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setString(1, title);

            ResultSet resultSet = statement.executeQuery();

            if (resultSet.next()) {

                int chatId = resultSet.getInt("id");

                createRootBranch(chatId);

                return chatId;
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка создания чата",
                    e
            );
        }

        throw new RuntimeException("Не удалось создать чат");
    }

    private int createRootBranch(int chatId) {

        String sql = """
                INSERT INTO branches (chat_id, parent_branch_id)
                VALUES (?, NULL)
                RETURNING id
                """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, chatId);

            ResultSet resultSet = statement.executeQuery();

            if (resultSet.next()) {
                return resultSet.getInt("id");
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка создания корневой ветки",
                    e
            );
        }

        throw new RuntimeException(
                "Не удалось создать корневую ветку"
        );
    }

    public void saveMessage(
            int branchId,
            String role,
            String content
    ) {

        String sql = """
                INSERT INTO messages
                    (branch_id, role, content)
                VALUES (?, ?, ?)
                """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, branchId);
            statement.setString(2, role);
            statement.setString(3, content);

            statement.executeUpdate();

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка сохранения сообщения",
                    e
            );
        }
    }

    public int createBranch(int parentBranchId) {

        Branch parent = getBranch(parentBranchId);

        if (parent == null) {
            throw new RuntimeException(
                    "Родительская ветка не найдена"
            );
        }

        String sql = """
                INSERT INTO branches
                    (chat_id, parent_branch_id)
                VALUES (?, ?)
                RETURNING id
                """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, parent.getChatId());
            statement.setInt(2, parentBranchId);

            ResultSet resultSet = statement.executeQuery();

            if (resultSet.next()) {
                return resultSet.getInt("id");
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка создания ветки",
                    e
            );
        }

        throw new RuntimeException(
                "Не удалось создать ветку"
        );
    }

    public Branch getBranch(int branchId) {

        String sql = """
                SELECT id, chat_id, parent_branch_id
                FROM branches
                WHERE id = ?
                """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, branchId);

            ResultSet resultSet = statement.executeQuery();

            if (resultSet.next()) {

                Integer parentId =
                        (Integer) resultSet.getObject(
                                "parent_branch_id"
                        );

                return new Branch(
                        resultSet.getInt("id"),
                        resultSet.getInt("chat_id"),
                        parentId
                );
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка получения ветки",
                    e
            );
        }

        return null;
    }

    private List<Message> getBranchMessages(
            int branchId
    ) {

        String sql = """
                SELECT id, branch_id, role, content
                FROM messages
                WHERE branch_id = ?
                ORDER BY id ASC
                """;

        List<Message> messages =
                new ArrayList<>();

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, branchId);

            ResultSet resultSet =
                    statement.executeQuery();

            while (resultSet.next()) {

                messages.add(
                        new Message(
                                resultSet.getInt("id"),
                                resultSet.getInt("branch_id"),
                                resultSet.getString("role"),
                                resultSet.getString("content")
                        )
                );
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка получения сообщений",
                    e
            );
        }

        return messages;
    }

    public List<Message> getFullHistory(
            int branchId
    ) {

        List<Message> history =
                new ArrayList<>();

        Branch current =
                getBranch(branchId);

        while (current != null) {

            List<Message> branchMessages =
                    getBranchMessages(current.getId());

            history.addAll(branchMessages);

            Integer parentId =
                    current.getParentBranchId();

            if (parentId == null) {
                break;
            }

            current = getBranch(parentId);
        }

        Collections.reverse(history);

        return history;
    }

    public List<Message> getLastMessages(
            int branchId,
            int limit
    ) {

        String sql = """
                SELECT id, branch_id, role, content
                FROM messages
                WHERE branch_id = ?
                ORDER BY id DESC
                LIMIT ?
                """;

        List<Message> messages =
                new ArrayList<>();

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, branchId);
            statement.setInt(2, limit);

            ResultSet resultSet =
                    statement.executeQuery();

            while (resultSet.next()) {

                messages.add(
                        new Message(
                                resultSet.getInt("id"),
                                resultSet.getInt("branch_id"),
                                resultSet.getString("role"),
                                resultSet.getString("content")
                        )
                );
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка получения последних сообщений",
                    e
            );
        }

        Collections.reverse(messages);

        return messages;
    }

    public List<Branch> getChatBranches(
            int chatId
    ) {

        String sql = """
                SELECT id, chat_id, parent_branch_id
                FROM branches
                WHERE chat_id = ?
                ORDER BY id
                """;

        List<Branch> branches =
                new ArrayList<>();

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, chatId);

            ResultSet resultSet =
                    statement.executeQuery();

            while (resultSet.next()) {

                Integer parentId =
                        (Integer) resultSet.getObject(
                                "parent_branch_id"
                        );

                branches.add(
                        new Branch(
                                resultSet.getInt("id"),
                                resultSet.getInt("chat_id"),
                                parentId
                        )
                );
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка получения веток",
                    e
            );
        }

        return branches;
    }

    public List<Branch> getChildBranches(
            int parentBranchId
    ) {

        String sql = """
                SELECT id, chat_id, parent_branch_id
                FROM branches
                WHERE parent_branch_id = ?
                ORDER BY id
                """;

        List<Branch> branches =
                new ArrayList<>();

        try (Connection connection = Database.getConnection();
             PreparedStatement statement =
                     connection.prepareStatement(sql)) {

            statement.setInt(1, parentBranchId);

            ResultSet resultSet =
                    statement.executeQuery();

            while (resultSet.next()) {

                Integer parentId =
                        (Integer) resultSet.getObject(
                                "parent_branch_id"
                        );

                branches.add(
                        new Branch(
                                resultSet.getInt("id"),
                                resultSet.getInt("chat_id"),
                                parentId
                        )
                );
            }

        } catch (SQLException e) {
            throw new RuntimeException(
                    "Ошибка получения дочерних веток",
                    e
            );
        }

        return branches;
    }
}