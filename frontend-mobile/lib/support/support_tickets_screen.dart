import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/paged_result.dart';
import '../models/support_ticket.dart';
import 'create_support_ticket_screen.dart';
import 'support_ticket_detail_screen.dart';

class SupportTicketsScreen extends StatefulWidget {
  final ApiClient? apiClient;

  const SupportTicketsScreen({super.key, this.apiClient});

  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;

  String? _statusFilter;
  bool _loading = true;
  String? _error;
  List<SupportTicket> _tickets = [];

  static const _statuses = [
    null, // All
    'Open',
    'InProgress',
    'WaitingForCustomer',
    'Resolved',
    'Closed',
  ];

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final json = await _apiClient.getMySupportTickets(
        status: _statusFilter,
        page: 1,
        pageSize: 50,
      );

      if (json != null && mounted) {
        final paged = PagedResult<SupportTicket>.fromJson(
          json as Map<String, dynamic>,
          SupportTicket.fromJson,
        );
        setState(() {
          _tickets = paged.items;
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
          _error = 'Could not load support tickets. Please try again.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _openCreateTicket([String? bookingId]) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateSupportTicketScreen(
          apiClient: _apiClient,
          preselectedBookingId: bookingId,
        ),
      ),
    );

    if (created == true && mounted) {
      _loadTickets();
    }
  }

  Future<void> _openTicketDetail(SupportTicket ticket) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SupportTicketDetailScreen(
          ticketId: ticket.id,
          apiClient: _apiClient,
        ),
      ),
    );

    if (mounted) {
      _loadTickets();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Help & Support'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('New Support Ticket'),
        onPressed: () => _openCreateTicket(),
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _statuses.map((s) {
                final isSelected = _statusFilter == s;
                final label = s == null ? 'All' : TicketStatusHelper.displayName(s);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(label),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() => _statusFilter = selected ? s : null);
                      _loadTickets();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1),

          // Content
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_error!, style: const TextStyle(color: Colors.red)),
                            const SizedBox(height: 12),
                            ElevatedButton(onPressed: _loadTickets, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _tickets.isEmpty
                        ? _buildEmptyState()
                        : RefreshIndicator(
                            onRefresh: _loadTickets,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _tickets.length,
                              itemBuilder: (context, index) {
                                final ticket = _tickets[index];
                                return _buildTicketCard(ticket);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.support_agent_outlined, size: 72, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            const Text(
              'No support tickets yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'If you need help with a booking, payment, trip, or the app, create a support ticket.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, height: 1.4),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Create Support Ticket'),
              onPressed: () => _openCreateTicket(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketCard(SupportTicket ticket) {
    final statusColor = TicketStatusHelper.color(ticket.status);
    final statusLabel = TicketStatusHelper.displayName(ticket.status);
    final priorityColor = TicketPriorityHelper.color(ticket.priority);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        onTap: () => _openTicketDetail(ticket),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Text(
          ticket.subject,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                Chip(
                  label: Text(ticket.category, style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                ),
                Chip(
                  label: Text(
                    ticket.priority,
                    style: TextStyle(color: priorityColor, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  backgroundColor: priorityColor.withValues(alpha: 0.12),
                  visualDensity: VisualDensity.compact,
                ),
                if (ticket.packageName != null)
                  Chip(
                    label: Text(ticket.packageName!, style: const TextStyle(fontSize: 11)),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Updated: ${ticket.updatedAt.toLocal().toString().split('.')[0]}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Chip(
              label: Text(
                statusLabel,
                style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              backgroundColor: statusColor.withValues(alpha: 0.12),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
      ),
    );
  }
}
