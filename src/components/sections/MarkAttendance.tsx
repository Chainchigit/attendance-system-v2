import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, UserCheck } from "lucide-react";
import { useGetUsers, useMarkAttendance, getGetUsersQueryKey, getGetAttendanceQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function MarkAttendance() {
  const [selectedName, setSelectedName] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsers({
    query: { queryKey: getGetUsersQueryKey() }
  });
  
  const markAttendance = useMarkAttendance();

  const handleMarkAttendance = () => {
    if (!selectedName) {
      toast({
        variant: "destructive",
        title: "Selection required",
        description: "Please select a member to mark attendance.",
      });
      return;
    }

    markAttendance.mutate(
      { data: { name: selectedName } },
      {
        onSuccess: () => {
          toast({
            title: "Attendance Recorded",
            description: `${selectedName} has been marked present.`,
            action: <CheckCircle2 className="h-5 w-5 text-green-500" />
          });
          setSelectedName("");
          queryClient.invalidateQueries({ queryKey: getGetAttendanceQueryKey() });
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to record attendance",
            description: ((error as unknown) as Record<string, unknown>)?.["error"] as string || "An error occurred.",
          });
        }
      }
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mark Attendance</h2>
        <p className="text-muted-foreground">Record daily attendance for registered members.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Check-in</CardTitle>
          <CardDescription>Select a member to mark them present for today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Registered Member</Label>
            {isLoadingUsers ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedName} onValueChange={setSelectedName} disabled={markAttendance.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.users && usersData.users.length > 0 ? (
                    usersData.users.map((user) => (
                      <SelectItem key={user.id} value={user.name}>
                        {user.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No registered members found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button 
            className="w-full" 
            onClick={handleMarkAttendance}
            disabled={!selectedName || markAttendance.isPending}
          >
            {markAttendance.isPending ? (
              <span>Recording...</span>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Mark Present
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
