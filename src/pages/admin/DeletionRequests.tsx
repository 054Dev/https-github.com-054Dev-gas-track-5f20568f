import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { SubNav } from "@/components/SubNav";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  handled_by: string | null;
  handled_at: string | null;
  profile?: {
    username: string;
    full_name: string;
  };
}

export default function DeletionRequests() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<"admin" | "co_admin" | "staff" | "customer">("admin");
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadRequests();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !['admin', 'co_admin', 'staff'].includes(roleData.role)) {
      navigate("/customer/dashboard");
      return;
    }

    setUser(user);
    setUserRole(roleData.role as "admin" | "co_admin" | "staff");
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deletion_requests")
        .select("*")
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data separately
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username, full_name")
            .eq("id", request.user_id)
            .single();

          return {
            ...request,
            profile: profileData
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    setLoading(true);
    try {
      if (actionType === 'approve') {
        // Delete the user's auth account (cascades to all related data)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          selectedRequest.user_id
        );
        
        if (deleteError) throw deleteError;

        // Update request status
        await supabase
          .from("deletion_requests")
          .update({
            status: 'approved',
            handled_by: user?.id,
            handled_at: new Date().toISOString()
          })
          .eq('id', selectedRequest.id);

        toast({
          title: "Account Deleted",
          description: "User account has been permanently deleted",
        });
      } else {
        // Reject the request
        await supabase
          .from("deletion_requests")
          .update({
            status: 'rejected',
            handled_by: user?.id,
            handled_at: new Date().toISOString()
          })
          .eq('id', selectedRequest.id);

        toast({
          title: "Request Rejected",
          description: "Deletion request has been rejected",
        });
      }

      loadRequests();
      setSelectedRequest(null);
      setActionType(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <SubNav role={userRole} />
        <div className="flex-1 flex items-center justify-center">
          <p>Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <SubNav role={userRole} />
      
      <div className="container py-8 flex-1">
        <div className="mb-6">
          <BackButton />
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Account Deletion Requests</h1>
          <p className="text-muted-foreground mt-2">
            Review and process customer account deletion requests
          </p>
        </div>

        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No deletion requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {request.profile?.full_name || 'Unknown User'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        @{request.profile?.username || 'unknown'}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Requested:</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'PPpp')}
                    </p>
                  </div>
                  
                  {request.reason && (
                    <div>
                      <p className="text-sm font-medium mb-1">Reason:</p>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
                    </div>
                  )}

                  {request.handled_at && (
                    <div>
                      <p className="text-sm font-medium mb-1">Handled:</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.handled_at), 'PPpp')}
                      </p>
                    </div>
                  )}

                  {request.status === 'pending' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType('approve');
                        }}
                      >
                        Approve & Delete Account
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setActionType('reject');
                        }}
                      >
                        Reject Request
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!selectedRequest} onOpenChange={() => {
        setSelectedRequest(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' 
                ? 'Confirm Account Deletion' 
                : 'Reject Deletion Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' ? (
                <>
                  Are you sure you want to delete the account for{' '}
                  <strong>{selectedRequest?.profile?.full_name}</strong>?
                  This action cannot be undone and will permanently delete all their data.
                </>
              ) : (
                <>
                  Are you sure you want to reject the deletion request from{' '}
                  <strong>{selectedRequest?.profile?.full_name}</strong>?
                  Their account will remain active.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={loading}
              className={actionType === 'approve' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {loading ? "Processing..." : actionType === 'approve' ? 'Delete Account' : 'Reject Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
