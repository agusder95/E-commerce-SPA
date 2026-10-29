namespace PaymentGateway.Infrastructure.Services;

// Broadcast, rather than consume, a change: all queues and all API instances must wake.
public sealed class OrderWorkSignal
{
    private readonly object _gate = new();
    private long _version;
    private TaskCompletionSource _changed = NewSource();
    private static TaskCompletionSource NewSource() => new(TaskCreationOptions.RunContinuationsAsynchronously);

    public long Version { get { lock (_gate) return _version; } }

    public void Pulse()
    {
        TaskCompletionSource previous;
        lock (_gate)
        {
            _version++;
            previous = _changed;
            _changed = NewSource();
        }
        previous.TrySetResult();
    }

    public async Task WaitAsync(long observedVersion, TimeSpan? delay, CancellationToken cancellationToken)
    {
        Task changed;
        lock (_gate)
        {
            if (_version != observedVersion) return; // A commit happened during the queue query.
            changed = _changed.Task;
        }
        if (delay is null) await changed.WaitAsync(cancellationToken);
        else
        {
            try { await changed.WaitAsync(delay.Value, cancellationToken); }
            catch (TimeoutException) { /* A persisted job is now due. */ }
        }
    }
}
