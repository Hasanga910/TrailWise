import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/support_ticket.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';

class SupportTicketDetailScreen extends StatefulWidget {
  final String ticketId;
  final ApiClient? apiClient;

  const SupportTicketDetailScreen({
    super.key,
    required this.ticketId,
    this.apiClient,
  });

  @override
  State<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState extends State<SupportTicketDetailScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  SupportTicket? _ticket;
  bool _loading = true;
  String? _error;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadTicket();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadTicket() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final json = await _apiClient.getSupportTicket(widget.ticketId);
      if (json != null && mounted) {
        setState(() {
          _ticket = SupportTicket.fromJson(json as Map<String, dynamic>);
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load ticket details.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    setState(() => _sending = true);

    try {
      await _apiClient.sendSupportMessage(widget.ticketId, text);
      _messageController.clear();
      await _loadTicket();
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send message. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_ticket?.subject ?? 'Ticket Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTicket,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_error!, style: TextStyle(color: colors.danger)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loadTicket,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    final colors = AppColors.of(context);
    final ticket = _ticket!;
    final statusColor = TicketStatusHelper.color(ticket.status);
    final statusLabel = TicketStatusHelper.displayName(ticket.status);
    final priorityColor = TicketPriorityHelper.color(ticket.priority);

    return Column(
      children: [
        // Ticket Overview Card (scrolls inside its own box on small screens)
        ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.4,
          ),
          child: SingleChildScrollView(
            child: Card(
              margin: const EdgeInsets.all(12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            ticket.subject,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        Chip(
                          label: Text(
                            statusLabel,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          backgroundColor: statusColor.withValues(alpha: 0.12),
                          visualDensity: VisualDensity.compact,
                        ),
                        Chip(
                          label: Text(
                            ticket.category,
                            style: const TextStyle(fontSize: 12),
                          ),
                          visualDensity: VisualDensity.compact,
                          avatar: const Icon(Icons.category, size: 14),
                        ),
                        Chip(
                          label: Text(
                            ticket.priority,
                            style: TextStyle(
                              color: priorityColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          backgroundColor: priorityColor.withValues(
                            alpha: 0.12,
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                        if (ticket.packageName != null)
                          Chip(
                            label: Text(
                              ticket.packageName!,
                              style: const TextStyle(fontSize: 12),
                            ),
                            visualDensity: VisualDensity.compact,
                            avatar: const Icon(Icons.card_travel, size: 14),
                          ),
                      ],
                    ),
                    const Divider(height: 20),
                    Text(
                      ticket.description,
                      style: const TextStyle(fontSize: 14, height: 1.4),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Created: ${ticket.createdAt.toLocal().toString().split('.')[0]}',
                      style: TextStyle(fontSize: 11, color: colors.fgMuted),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Conversation thread
        Expanded(
          child: ticket.messages.isEmpty
              ? Center(
                  child: Text(
                    'No replies yet. Our support team will respond shortly.',
                    style: TextStyle(
                      color: colors.fgMuted,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  itemCount: ticket.messages.length,
                  itemBuilder: (context, index) {
                    final msg = ticket.messages[index];
                    return _buildMessageBubble(msg);
                  },
                ),
        ),

        // Bottom input bar
        _buildBottomBar(ticket),
      ],
    );
  }

  Widget _buildMessageBubble(SupportMessage msg) {
    final colors = AppColors.of(context);
    final isStaff = msg.isStaff;
    final align = isStaff ? CrossAxisAlignment.start : CrossAxisAlignment.end;
    final bgColor = isStaff ? colors.surfaceSunken : colors.infoSoft;
    final borderColor = isStaff ? colors.border : colors.border;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isStaff) ...[
                Icon(Icons.support_agent, size: 16, color: colors.info),
                const SizedBox(width: 4),
                Text(
                  'TrailWise Support',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: colors.info,
                  ),
                ),
              ] else ...[
                Text(
                  'You',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: colors.info,
                  ),
                ),
              ],
              const SizedBox(width: 8),
              Text(
                '${msg.createdAt.toLocal().hour.toString().padLeft(2, '0')}:${msg.createdAt.toLocal().minute.toString().padLeft(2, '0')}',
                style: TextStyle(fontSize: 10, color: colors.fgMuted),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.8,
            ),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderColor),
            ),
            child: Text(
              msg.message,
              style: const TextStyle(fontSize: 14, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(SupportTicket ticket) {
    final colors = AppColors.of(context);
    if (ticket.isClosed) {
      return Container(
        width: double.infinity,
        padding: EdgeInsets.all(16),
        color: colors.border,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock_outline, size: 18, color: colors.fgMuted),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                'This support ticket is closed.',
                style: TextStyle(color: colors.fg, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceRaised,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Type your message...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(24)),
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                ),
                maxLines: null,
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send),
              onPressed: _sending ? null : _sendMessage,
            ),
          ],
        ),
      ),
    );
  }
}
