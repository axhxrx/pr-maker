import { BatchImport } from '@axhxrx/internationalization-format-converter';

/**
 This implementation applies a proposed translations changeset, in the format defined by @axhxrx/internationalization-format-converter, to the checked out repo. This is obviously a very specific use case, but it is the first use case for which this library was developed.

 In the future, though, we could make this more generic by allowing the user of this lib to override this, to apply other kinds of changesets.

 @param tempCheckoutDir - Temporary directory where the correct branch and revision of the target repository have already been checked out

 @param proposedChanges - JSON changeset in the format defined by @axhxrx/internationalization-format-converter
 */
export async function applyProposedChanges(tempCheckoutDir: string, proposedChanges: Record<string, unknown>)
{
  console.log('applyProposedChanges(): Applying code changes...');
  console.log('applyProposedChanges(): Proposed changes:', JSON.stringify(proposedChanges));

  const batchImport = new BatchImport(
    proposedChanges,
  );

  const importResult = await batchImport.run(tempCheckoutDir);

  // FIXME: This is a type bug in the upstream @axhxrx/internationalization-format-converter library — this result type is not defined properly. Fix it upstream and then fix here.
  const error = (importResult as { error: Error }).error;
  if (error)
  {
    throw error;
  }

  console.log('Code changes applied successfully.');
  console.log(tempCheckoutDir);
}
