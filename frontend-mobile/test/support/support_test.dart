import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/models/support_ticket.dart';
import 'package:trailwise_mobile/support/create_support_ticket_screen.dart';
import 'package:trailwise_mobile/support/support_ticket_detail_screen.dart';
import 'package:trailwise_mobile/support/support_tickets_screen.dart';

class SupportTestApiClient extends ApiClient {
  SupportTestApiClient({
    this.getHandler,
    this.postHandler,
  });

  Future<dynamic> Function(String path, Map<String, dynamic>? query)? getHandler;
  Future<Map<String, dynamic>> Function(String path, Map<String, dynamic> body)? postHandler;

  final List<String> getCalls = [];
  final List<Map<String, dynamic>?> getQueries = [];
  final List<String> postCalls = [];
  final List<Map<String, dynamic>> postBodies = [];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    getCalls.add(path);
    getQueries.add(query);
    if (getHandler != null) {
      return getHandler!(path, query);
    }
    return null;
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    postCalls.add(path);
    postBodies.add(body);
    if (postHandler != null) {
      return postHandler!(path, body);
    }
    return <String, dynamic>{};
  }
}

void main() {
  group('Support Model Parsing', () {
    test('parses SupportTicket list DTO correctly', () {
      final json = {
        'id': 'ticket-1',
        'category': 'Trip',
        'priority': 'Normal',
        'status': 'Open',
        'subject': 'Need help with itinerary',
        'bookingId': 'book-1',
        'packageName': 'Ella Adventure',
        'assignedToId': null,
        'createdAt': '2026-09-29T10:00:00Z',
        'updatedAt': '2026-09-29T10:05:00Z',
      };

      final ticket = SupportTicket.fromJson(json);
      expect(ticket.id, 'ticket-1');
      expect(ticket.category, 'Trip');
      expect(ticket.priority, 'Normal');
      expect(ticket.status, 'Open');
      expect(ticket.subject, 'Need help with itinerary');
      expect(ticket.bookingId, 'book-1');
      expect(ticket.packageName, 'Ella Adventure');
      expect(ticket.assignedToId, isNull);
      expect(ticket.createdAt, DateTime.parse('2026-09-29T10:00:00Z'));
      expect(ticket.updatedAt, DateTime.parse('2026-09-29T10:05:00Z'));
      expect(ticket.messages, isEmpty);
    });

    test('parses SupportTicket detail DTO with messages', () {
      final json = {
        'id': 'ticket-2',
        'category': 'Payment',
        'priority': 'High',
        'status': 'WaitingForCustomer',
        'subject': 'Payment confirmation missing',
        'description': 'I uploaded the bank slip yesterday but no confirmation.',
        'travelerId': 'trav-1',
        'travelerDisplayName': 'John Traveler',
        'bookingId': 'book-2',
        'packageName': 'Sigiriya Tour',
        'assignedToId': 'staff-1',
        'assignedToName': 'Support Agent Sarah',
        'createdAt': '2026-09-29T08:00:00Z',
        'updatedAt': '2026-09-29T09:00:00Z',
        'resolvedAt': null,
        'closedAt': null,
        'messages': [
          {
            'id': 'msg-1',
            'senderId': 'staff-1',
            'senderDisplayName': 'Support Agent Sarah',
            'isStaff': true,
            'message': 'We have reviewed your slip and verified it.',
            'createdAt': '2026-09-29T09:00:00Z',
          }
        ],
      };

      final ticket = SupportTicket.fromJson(json);
      expect(ticket.id, 'ticket-2');
      expect(ticket.category, 'Payment');
      expect(ticket.priority, 'High');
      expect(ticket.status, 'WaitingForCustomer');
      expect(ticket.description, 'I uploaded the bank slip yesterday but no confirmation.');
      expect(ticket.travelerDisplayName, 'John Traveler');
      expect(ticket.assignedToName, 'Support Agent Sarah');
      expect(ticket.messages.length, 1);

      final msg = ticket.messages.first;
      expect(msg.id, 'msg-1');
      expect(msg.senderId, 'staff-1');
      expect(msg.senderDisplayName, 'Support Agent Sarah');
      expect(msg.isStaff, isTrue);
      expect(msg.message, 'We have reviewed your slip and verified it.');
    });
  });

  group('SupportTicketsScreen', () {
    testWidgets('renders ticket list correctly', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/support/tickets/mine') {
            return {
              'items': [
                {
                  'id': 'ticket-1',
                  'category': 'Trip',
                  'priority': 'Normal',
                  'status': 'Open',
                  'subject': 'Delay inquiry',
                  'bookingId': null,
                  'packageName': null,
                  'assignedToId': null,
                  'createdAt': '2026-09-29T10:00:00Z',
                  'updatedAt': '2026-09-29T10:05:00Z',
                }
              ],
              'totalCount': 1,
              'page': 1,
              'pageSize': 10,
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketsScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Help & Support'), findsOneWidget);
      expect(find.text('Delay inquiry'), findsOneWidget);
      expect(find.text('Trip'), findsOneWidget);
      expect(find.text('Open'), findsNWidgets(2));
    });

    testWidgets('shows empty state message when no tickets exist', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/support/tickets/mine') {
            return {
              'items': [],
              'totalCount': 0,
              'page': 1,
              'pageSize': 10,
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketsScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No support tickets yet'), findsOneWidget);
      expect(
        find.text('If you need help with a booking, payment, trip, or the app, create a support ticket.'),
        findsOneWidget,
      );
      expect(find.text('New Support Ticket'), findsWidgets);
    });

    testWidgets('status filter chips trigger filter query', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          return {
            'items': [],
            'totalCount': 0,
            'page': 1,
            'pageSize': 10,
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketsScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      // Tap on 'Open' filter chip
      await tester.tap(find.widgetWithText(FilterChip, 'Open'));
      await tester.pumpAndSettle();

      expect(client.getQueries.last?['status'], 'Open');
    });
  });

  group('CreateSupportTicketScreen', () {
    testWidgets('shows validation errors for invalid input', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {
              'items': [],
              'totalCount': 0,
              'page': 1,
              'pageSize': 50,
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateSupportTicketScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      // Submit empty form
      await tester.tap(find.byKey(const Key('ticket-submit-button')));
      await tester.pumpAndSettle();

      expect(find.text('Subject must be at least 5 characters.'), findsOneWidget);
      expect(find.text('Please enter a description.'), findsOneWidget);

      // Enter short subject
      await tester.enterText(find.byKey(const Key('ticket-subject-field')), 'Hi');
      await tester.tap(find.byKey(const Key('ticket-submit-button')));
      await tester.pumpAndSettle();

      expect(find.text('Subject must be at least 5 characters.'), findsOneWidget);
    });

    testWidgets('submits ticket successfully without urgent priority', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {
              'items': [
                {
                  'id': 'b1',
                  'travelerId': 't1',
                  'tourPackageId': 'p1',
                  'tourPackageName': 'Kandy Cultural Tour',
                  'packageTier': {
                    'id': 'tier-1',
                    'classType': 'Normal',
                    'includesFood': false,
                    'basePricePerPerson': 100,
                    'requiresAC': false,
                  },
                  'groupSize': 2,
                  'startDate': '2026-11-01',
                  'endDate': '2026-11-03',
                  'budgetPerPerson': 120,
                  'status': 'Confirmed',
                  'isLargeGroup': false,
                  'hasReview': false,
                }
              ],
              'totalCount': 1,
              'page': 1,
              'pageSize': 50,
            };
          }
          return null;
        },
        postHandler: (path, body) async {
          if (path == '/api/support/tickets') {
            return {
              'id': 'new-ticket-id',
              'category': body['category'],
              'priority': 'Normal',
              'status': 'Open',
              'subject': body['subject'],
            };
          }
          return {};
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateSupportTicketScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      // Ensure Urgent is NOT an option anywhere in the UI
      expect(find.text('Urgent'), findsNothing);

      await tester.enterText(
        find.byKey(const Key('ticket-subject-field')),
        'Need help with hotel pickup',
      );
      await tester.enterText(
        find.byKey(const Key('ticket-description-field')),
        'Can we change the pickup location to airport instead of hotel?',
      );

      await tester.tap(find.byKey(const Key('ticket-submit-button')));
      await tester.pumpAndSettle();

      expect(client.postCalls, contains('/api/support/tickets'));
      expect(client.postBodies.first['subject'], 'Need help with hotel pickup');
      expect(client.postBodies.first['category'], 'Trip');
    });

    testWidgets('preselects booking when preselectedBookingId provided', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {
              'items': [
                {
                  'id': 'booking-special-1',
                  'travelerId': 't1',
                  'tourPackageId': 'p1',
                  'tourPackageName': 'Galle Fort Explorer',
                  'packageTier': {
                    'id': 'tier-1',
                    'classType': 'Normal',
                    'includesFood': false,
                    'basePricePerPerson': 150,
                    'requiresAC': false,
                  },
                  'groupSize': 1,
                  'startDate': '2026-12-01',
                  'endDate': '2026-12-02',
                  'budgetPerPerson': 150,
                  'status': 'Completed',
                  'isLargeGroup': false,
                  'hasReview': false,
                }
              ],
              'totalCount': 1,
              'page': 1,
              'pageSize': 50,
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateSupportTicketScreen(
          apiClient: client,
          preselectedBookingId: 'booking-special-1',
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Galle Fort Explorer'), findsOneWidget);
    });

    testWidgets('shows error banner on create failure', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {'items': [], 'totalCount': 0, 'page': 1, 'pageSize': 50};
          }
          return null;
        },
        postHandler: (path, body) async {
          throw ApiException(400, 'Invalid ticket data provided');
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateSupportTicketScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('ticket-subject-field')), 'Valid subject');
      await tester.enterText(find.byKey(const Key('ticket-description-field')), 'Valid description');
      await tester.tap(find.byKey(const Key('ticket-submit-button')));
      await tester.pumpAndSettle();

      expect(find.text('Invalid ticket data provided'), findsOneWidget);
    });

    testWidgets('renders properly without layout overflow on narrow screens with long booking labels', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {
              'items': [
                {
                  'id': 'booking-long-1',
                  'travelerId': 't1',
                  'tourPackageId': 'p1',
                  'tourPackageName': 'Ultra Extremely Long Package Name That Exceeds The Narrow Mobile Screen Width Without A Doubt',
                  'packageTier': {
                    'id': 'tier-1',
                    'classType': 'Premium',
                    'includesFood': true,
                    'basePricePerPerson': 500,
                    'requiresAC': true,
                  },
                  'groupSize': 4,
                  'startDate': '2026-12-01',
                  'endDate': '2026-12-10',
                  'budgetPerPerson': 500,
                  'status': 'Confirmed',
                  'isLargeGroup': false,
                  'hasReview': false,
                }
              ],
              'totalCount': 1,
              'page': 1,
              'pageSize': 50,
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: CreateSupportTicketScreen(
          apiClient: client,
          preselectedBookingId: 'booking-long-1',
        ),
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('Ultra Extremely Long Package Name'), findsOneWidget);
    });
  });

  group('SupportTicketDetailScreen', () {
    testWidgets('renders detail header and messages with alignment', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/support/tickets/ticket-123') {
            return {
              'id': 'ticket-123',
              'category': 'Account',
              'priority': 'Normal',
              'status': 'InProgress',
              'subject': 'Cannot reset password',
              'description': 'The reset link expired before I opened it.',
              'travelerId': 'trav-1',
              'travelerDisplayName': 'John Traveler',
              'bookingId': null,
              'packageName': null,
              'assignedToId': 'staff-1',
              'assignedToName': 'Support Agent Alex',
              'createdAt': '2026-09-29T10:00:00Z',
              'updatedAt': '2026-09-29T10:10:00Z',
              'resolvedAt': null,
              'closedAt': null,
              'messages': [
                {
                  'id': 'm1',
                  'senderId': 'trav-1',
                  'senderDisplayName': 'John Traveler',
                  'isStaff': false,
                  'message': 'Here is another message from traveler',
                  'createdAt': '2026-09-29T10:05:00Z',
                },
                {
                  'id': 'm2',
                  'senderId': 'staff-1',
                  'senderDisplayName': 'Support Agent Alex',
                  'isStaff': true,
                  'message': 'We have sent a fresh reset link to your email.',
                  'createdAt': '2026-09-29T10:10:00Z',
                },
              ],
            };
          }
          return null;
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketDetailScreen(
          ticketId: 'ticket-123',
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Cannot reset password'), findsNWidgets(2));
      expect(find.text('The reset link expired before I opened it.'), findsOneWidget);
      expect(find.text('TrailWise Support'), findsOneWidget);
      expect(find.text('Here is another message from traveler'), findsOneWidget);
      expect(find.text('We have sent a fresh reset link to your email.'), findsOneWidget);
    });

    testWidgets('sends reply message and triggers reload', (tester) async {
      int getCalls = 0;
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          getCalls++;
          return {
            'id': 'ticket-123',
            'category': 'Account',
            'priority': 'Normal',
            'status': 'InProgress',
            'subject': 'Cannot reset password',
            'description': 'The reset link expired before I opened it.',
            'travelerId': 'trav-1',
            'travelerDisplayName': 'John Traveler',
            'bookingId': null,
            'packageName': null,
            'assignedToId': null,
            'createdAt': '2026-09-29T10:00:00Z',
            'updatedAt': '2026-09-29T10:10:00Z',
            'messages': [],
          };
        },
        postHandler: (path, body) async {
          return {
            'id': 'm-new',
            'senderId': 'trav-1',
            'senderDisplayName': 'John Traveler',
            'isStaff': false,
            'message': body['message'],
            'createdAt': '2026-09-29T10:15:00Z',
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketDetailScreen(
          ticketId: 'ticket-123',
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      expect(getCalls, 1);

      await tester.enterText(find.widgetWithText(TextField, 'Type your message...'), 'Thank you, received!');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(client.postCalls, contains('/api/support/tickets/ticket-123/messages'));
      expect(client.postBodies.first['message'], 'Thank you, received!');
      expect(getCalls, greaterThanOrEqualTo(2));
    });

    testWidgets('closed ticket disables input and shows notice', (tester) async {
      final client = SupportTestApiClient(
        getHandler: (path, query) async {
          return {
            'id': 'ticket-999',
            'category': 'Other',
            'priority': 'Low',
            'status': 'Closed',
            'subject': 'General question',
            'description': 'Question that has been resolved and closed.',
            'travelerId': 'trav-1',
            'travelerDisplayName': 'John Traveler',
            'bookingId': null,
            'packageName': null,
            'assignedToId': null,
            'createdAt': '2026-09-29T10:00:00Z',
            'updatedAt': '2026-09-29T10:10:00Z',
            'closedAt': '2026-09-29T10:10:00Z',
            'messages': [],
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: SupportTicketDetailScreen(
          ticketId: 'ticket-999',
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('This support ticket is closed.'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Type your message...'), findsNothing);
    });
  });

  group('Support API Authentication and Routing', () {
    test('getMySupportTickets calls /api/support/tickets/mine and sends Authorization header', () async {
      http.Request? capturedRequest;
      final mockClient = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'items': [], 'totalCount': 0, 'page': 1, 'pageSize': 10}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      final client = ApiClient(httpClient: mockClient);
      client.setToken('test-jwt-token-123');

      await client.getMySupportTickets(status: 'Open', page: 2, pageSize: 20);

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.method, 'GET');
      expect(capturedRequest!.url.path, '/api/support/tickets/mine');
      expect(capturedRequest!.url.queryParameters['status'], 'Open');
      expect(capturedRequest!.url.queryParameters['page'], '2');
      expect(capturedRequest!.url.queryParameters['pageSize'], '20');
      expect(capturedRequest!.headers['Authorization'], 'Bearer test-jwt-token-123');
    });

    test('createSupportTicket calls /api/support/tickets and sends Authorization header', () async {
      http.Request? capturedRequest;
      final mockClient = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'id': 'ticket-1', 'subject': 'Need Help'}),
          201,
          headers: {'content-type': 'application/json'},
        );
      });
      final client = ApiClient(httpClient: mockClient);
      client.setToken('test-jwt-token-123');

      await client.createSupportTicket(
        category: 'Trip',
        subject: 'Need Help with Tour',
        description: 'Tour guide did not arrive on time',
        bookingId: 'book-123',
      );

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.method, 'POST');
      expect(capturedRequest!.url.path, '/api/support/tickets');
      expect(capturedRequest!.headers['Authorization'], 'Bearer test-jwt-token-123');
      final body = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(body['category'], 'Trip');
      expect(body['subject'], 'Need Help with Tour');
      expect(body['description'], 'Tour guide did not arrive on time');
      expect(body['bookingId'], 'book-123');
    });

    test('getSupportTicket calls /api/support/tickets/{id} and sends Authorization header', () async {
      http.Request? capturedRequest;
      final mockClient = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'id': 'ticket-123', 'subject': 'Need Help', 'messages': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });
      final client = ApiClient(httpClient: mockClient);
      client.setToken('test-jwt-token-123');

      await client.getSupportTicket('ticket-123');

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.method, 'GET');
      expect(capturedRequest!.url.path, '/api/support/tickets/ticket-123');
      expect(capturedRequest!.headers['Authorization'], 'Bearer test-jwt-token-123');
    });

    test('sendSupportMessage calls /api/support/tickets/{id}/messages and sends Authorization header', () async {
      http.Request? capturedRequest;
      final mockClient = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({'id': 'msg-1', 'message': 'Followup message'}),
          201,
          headers: {'content-type': 'application/json'},
        );
      });
      final client = ApiClient(httpClient: mockClient);
      client.setToken('test-jwt-token-123');

      await client.sendSupportMessage('ticket-123', 'Followup message');

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.method, 'POST');
      expect(capturedRequest!.url.path, '/api/support/tickets/ticket-123/messages');
      expect(capturedRequest!.headers['Authorization'], 'Bearer test-jwt-token-123');
      final body = jsonDecode(capturedRequest!.body) as Map<String, dynamic>;
      expect(body['message'], 'Followup message');
    });

    testWidgets('SupportTicketsScreen resolves authenticated ApiClient from AuthProvider when widget.apiClient is null', (tester) async {
      final authenticatedClient = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/support/tickets/mine') {
            return {
              'items': [
                {
                  'id': 'ticket-auth-1',
                  'category': 'Account',
                  'priority': 'Normal',
                  'status': 'Open',
                  'subject': 'Auth Provider Ticket Test',
                  'createdAt': '2026-09-29T10:00:00Z',
                  'updatedAt': '2026-09-29T10:05:00Z',
                }
              ],
              'totalCount': 1,
              'page': 1,
              'pageSize': 50,
            };
          }
          return null;
        },
      );
      authenticatedClient.setToken('valid-auth-token');

      final authProvider = AuthProvider(apiClient: authenticatedClient);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(
            home: SupportTicketsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Auth Provider Ticket Test'), findsOneWidget);
      expect(authenticatedClient.getCalls, contains('/api/support/tickets/mine'));
      expect(authenticatedClient.token, 'valid-auth-token');
      expect(authenticatedClient.headers['Authorization'], 'Bearer valid-auth-token');
    });

    testWidgets('CreateSupportTicketScreen resolves authenticated ApiClient from AuthProvider when widget.apiClient is null', (tester) async {
      final authenticatedClient = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/bookings/mine') {
            return {'items': [], 'totalCount': 0, 'page': 1, 'pageSize': 50};
          }
          return null;
        },
        postHandler: (path, body) async {
          if (path == '/api/support/tickets') {
            return {'id': 'ticket-new', 'subject': body['subject']};
          }
          return {};
        },
      );
      authenticatedClient.setToken('valid-auth-token');

      final authProvider = AuthProvider(apiClient: authenticatedClient);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(
            home: CreateSupportTicketScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('ticket-subject-field')), 'Ticket from AuthProvider');
      await tester.enterText(find.byKey(const Key('ticket-description-field')), 'Description test content');
      await tester.tap(find.byKey(const Key('ticket-submit-button')));
      await tester.pumpAndSettle();

      expect(authenticatedClient.postCalls, contains('/api/support/tickets'));
      expect(authenticatedClient.token, 'valid-auth-token');
      expect(authenticatedClient.headers['Authorization'], 'Bearer valid-auth-token');
    });

    testWidgets('SupportTicketDetailScreen resolves authenticated ApiClient from AuthProvider when widget.apiClient is null', (tester) async {
      final authenticatedClient = SupportTestApiClient(
        getHandler: (path, query) async {
          if (path == '/api/support/tickets/ticket-detail-1') {
            return {
              'id': 'ticket-detail-1',
              'category': 'Trip',
              'priority': 'Normal',
              'status': 'Open',
              'subject': 'Detail From AuthProvider',
              'description': 'Checking detail screen auth injection',
              'travelerId': 'trav-1',
              'travelerDisplayName': 'John Traveler',
              'createdAt': '2026-09-29T10:00:00Z',
              'updatedAt': '2026-09-29T10:05:00Z',
              'messages': [],
            };
          }
          return null;
        },
      );
      authenticatedClient.setToken('valid-auth-token');

      final authProvider = AuthProvider(apiClient: authenticatedClient);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(
            home: SupportTicketDetailScreen(ticketId: 'ticket-detail-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Detail From AuthProvider'), findsNWidgets(2));
      expect(authenticatedClient.getCalls, contains('/api/support/tickets/ticket-detail-1'));
      expect(authenticatedClient.token, 'valid-auth-token');
      expect(authenticatedClient.headers['Authorization'], 'Bearer valid-auth-token');
    });
  });
}

