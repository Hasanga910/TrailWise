import 'package:flutter/material.dart';

class TicketStatusHelper {
  static Color color(String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return Colors.blue.shade700;
      case 'inprogress':
        return Colors.orange.shade800;
      case 'waitingforcustomer':
        return Colors.purple.shade700;
      case 'resolved':
        return Colors.green.shade700;
      case 'closed':
        return Colors.grey.shade700;
      default:
        return Colors.grey.shade600;
    }
  }

  static String displayName(String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return 'Open';
      case 'inprogress':
        return 'In Progress';
      case 'waitingforcustomer':
        return 'Waiting for Customer';
      case 'resolved':
        return 'Resolved';
      case 'closed':
        return 'Closed';
      default:
        return status;
    }
  }
}

class TicketPriorityHelper {
  static Color color(String priority) {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return Colors.red.shade700;
      case 'high':
        return Colors.deepOrange.shade700;
      case 'normal':
        return Colors.blue.shade700;
      case 'low':
        return Colors.teal.shade700;
      default:
        return Colors.grey.shade700;
    }
  }
}

class SupportMessage {
  final String id;
  final String senderId;
  final String senderDisplayName;
  final bool isStaff;
  final String message;
  final DateTime createdAt;

  SupportMessage({
    required this.id,
    required this.senderId,
    required this.senderDisplayName,
    required this.isStaff,
    required this.message,
    required this.createdAt,
  });

  factory SupportMessage.fromJson(Map<String, dynamic> json) => SupportMessage(
        id: (json['id'] ?? json['Id']) as String,
        senderId: (json['senderId'] ?? json['SenderId']) as String,
        senderDisplayName:
            (json['senderDisplayName'] ?? json['SenderDisplayName'] ?? 'User') as String,
        isStaff: (json['isStaff'] ?? json['IsStaff'] ?? false) as bool,
        message: (json['message'] ?? json['Message'] ?? '') as String,
        createdAt: DateTime.parse(
            (json['createdAt'] ?? json['CreatedAt'] ?? DateTime.now().toIso8601String()) as String),
      );
}

class SupportTicket {
  final String id;
  final String category;
  final String priority;
  final String status;
  final String subject;
  final String description;
  final String? travelerId;
  final String? travelerDisplayName;
  final String? bookingId;
  final String? packageName;
  final String? assignedToId;
  final String? assignedToName;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? resolvedAt;
  final DateTime? closedAt;
  final List<SupportMessage> messages;

  SupportTicket({
    required this.id,
    required this.category,
    required this.priority,
    required this.status,
    required this.subject,
    this.description = '',
    this.travelerId,
    this.travelerDisplayName,
    this.bookingId,
    this.packageName,
    this.assignedToId,
    this.assignedToName,
    required this.createdAt,
    required this.updatedAt,
    this.resolvedAt,
    this.closedAt,
    this.messages = const [],
  });

  bool get isClosed => status.toLowerCase() == 'closed';
  bool get isResolved => status.toLowerCase() == 'resolved';

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    final rawMessages = (json['messages'] ?? json['Messages']) as List<dynamic>?;
    final messages = rawMessages != null
        ? rawMessages
            .map((m) => SupportMessage.fromJson(m as Map<String, dynamic>))
            .toList()
        : <SupportMessage>[];

    final resolvedStr = (json['resolvedAt'] ?? json['ResolvedAt']) as String?;
    final closedStr = (json['closedAt'] ?? json['ClosedAt']) as String?;

    return SupportTicket(
      id: (json['id'] ?? json['Id']) as String,
      category: (json['category'] ?? json['Category'] ?? 'Other') as String,
      priority: (json['priority'] ?? json['Priority'] ?? 'Normal') as String,
      status: (json['status'] ?? json['Status'] ?? 'Open') as String,
      subject: (json['subject'] ?? json['Subject'] ?? '') as String,
      description: (json['description'] ?? json['Description'] ?? '') as String,
      travelerId: (json['travelerId'] ?? json['TravelerId']) as String?,
      travelerDisplayName: (json['travelerDisplayName'] ?? json['TravelerDisplayName']) as String?,
      bookingId: (json['bookingId'] ?? json['BookingId']) as String?,
      packageName: (json['packageName'] ?? json['PackageName']) as String?,
      assignedToId: (json['assignedToId'] ?? json['AssignedToId']) as String?,
      assignedToName: (json['assignedToName'] ?? json['AssignedToName']) as String?,
      createdAt: DateTime.parse(
          (json['createdAt'] ?? json['CreatedAt'] ?? DateTime.now().toIso8601String()) as String),
      updatedAt: DateTime.parse(
          (json['updatedAt'] ?? json['UpdatedAt'] ?? DateTime.now().toIso8601String()) as String),
      resolvedAt: resolvedStr != null ? DateTime.parse(resolvedStr) : null,
      closedAt: closedStr != null ? DateTime.parse(closedStr) : null,
      messages: messages,
    );
  }
}
