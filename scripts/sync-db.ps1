param(
  [string]$DbPath = "./db.json",
  [int]$Seed = 20260404
)

$ErrorActionPreference = 'Stop'

function Get-RandomFrom([object[]]$arr) {
  return $arr | Get-Random
}

function New-IsoDate([datetime]$dt) {
  return $dt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function New-RandDate([datetime]$start, [datetime]$end) {
  $span = $end - $start
  $seconds = [int][math]::Max(0, $span.TotalSeconds)
  if ($seconds -le 0) { return $start }
  $offset = Get-Random -Minimum 0 -Maximum $seconds
  return $start.AddSeconds($offset)
}

function Round-ToInt([double]$value) {
  return [int][math]::Round($value, 0, [MidpointRounding]::AwayFromZero)
}

# Load
if (-not (Test-Path $DbPath)) {
  throw "db.json not found at path: $DbPath"
}

$resolvedDbPath = (Resolve-Path $DbPath)
$jsonRaw = [System.IO.File]::ReadAllText($resolvedDbPath, [System.Text.Encoding]::UTF8)
$data = $jsonRaw | ConvertFrom-Json

# Deterministic randomness for reproducibility
$null = Get-Random -SetSeed $Seed

# Lookups
$booksById = @{}
foreach ($b in $data.books) { $booksById[$b.id] = $b }

$usersById = @{}
foreach ($u in $data.users) { $usersById[$u.id] = $u }

$promosById = @{}
foreach ($p in $data.promotions) { $promosById[$p.id] = $p }

$bookItemsById = @{}
$bookItemsByBookId = @{}
foreach ($bi in $data.book_items) {
  $bookItemsById[$bi.id] = $bi
  if (-not $bookItemsByBookId.ContainsKey($bi.book_id)) { $bookItemsByBookId[$bi.book_id] = @() }
  $bookItemsByBookId[$bi.book_id] += $bi
}

function Get-SaleItemId([string]$bookId) {
  if (-not $bookItemsByBookId.ContainsKey($bookId)) { return $null }
  $sale = $bookItemsByBookId[$bookId] | Where-Object { $_.is_for_rent -eq 0 } | Select-Object -First 1
  return $sale.id
}

function Get-RentItemId([string]$bookId) {
  if (-not $bookItemsByBookId.ContainsKey($bookId)) { return $null }
  $rent = $bookItemsByBookId[$bookId] | Where-Object { $_.is_for_rent -eq 1 } | Select-Object -First 1
  return $rent.id
}

# Next IDs
function Get-MaxIntId($arr) {
  if (-not $arr) { return 0 }
  return ($arr | ForEach-Object { [int]$_.id } | Measure-Object -Maximum).Maximum
}

$nextOrderId = (Get-MaxIntId $data.orders) + 1
$nextRentalId = (Get-MaxIntId $data.rentals) + 1
$nextReviewId = (Get-MaxIntId $data.reviews) + 1

# Build current counts from existing data
$currentSold = @{}
foreach ($b in $data.books) { $currentSold[$b.id] = 0 }
foreach ($o in $data.orders) {
  foreach ($it in $o.items) {
    $bi = $bookItemsById[$it.book_item_id]
    if ($null -ne $bi) {
      $bid = $bi.book_id
      if ($currentSold.ContainsKey($bid)) { $currentSold[$bid]++ }
    }
  }
}

$currentRent = @{}
foreach ($b in $data.books) { $currentRent[$b.id] = 0 }
foreach ($r in $data.rentals) {
  $bi = $bookItemsById[$r.book_item_id]
  if ($null -ne $bi) {
    $bid = $bi.book_id
    if ($currentRent.ContainsKey($bid)) { $currentRent[$bid]++ }
  }
}

# Targets (balanced, moderate)
# Books 11-70: sold 2..6, rent 1..3 (some 0 rentals)
# Books 1-10: keep existing, add a little for balance
$saleTargets = @{}
$rentTargets = @{}
foreach ($b in $data.books) {
  $idInt = [int]$b.id
  if ($idInt -ge 11) {
    $saleTargets[$b.id] = Get-Random -Minimum 2 -Maximum 7
    # 25% chance of no rentals
    if ((Get-Random -Minimum 1 -Maximum 101) -le 25) {
      $rentTargets[$b.id] = 0
    } else {
      $rentTargets[$b.id] = Get-Random -Minimum 1 -Maximum 4
    }
  } else {
    $saleTargets[$b.id] = $currentSold[$b.id] + (Get-Random -Minimum 0 -Maximum 3)
    $rentTargets[$b.id] = $currentRent[$b.id] + (Get-Random -Minimum 0 -Maximum 2)
  }
}

# Create missing sale lines
$saleLines = New-Object System.Collections.Generic.List[object]
foreach ($b in $data.books) {
  $need = $saleTargets[$b.id] - $currentSold[$b.id]
  if ($need -le 0) { continue }

  $saleItemId = Get-SaleItemId $b.id
  if (-not $saleItemId) { throw "Missing sale book_item for book_id=$($b.id)" }

  for ($i=0; $i -lt $need; $i++) {
    $saleLines.Add([pscustomobject]@{
      book_item_id = $saleItemId
      title        = $b.title
      unit_price   = $b.selling_price
      book_id      = $b.id
    })
  }
}

# Shuffle sale lines
$saleLines = $saleLines | Get-Random -Count $saleLines.Count

$addresses = @($data.orders.shipping_address | Where-Object { $_ } | Select-Object -Unique)
if (-not $addresses -or $addresses.Count -eq 0) {
  $addresses = @("Ha Noi","TP. Ho Chi Minh","Da Nang","Hai Phong","Can Tho","Binh Duong","Nha Trang","Hue")
}

$paymentMethods = @($data.orders.payment_method | Where-Object { $_ } | Select-Object -Unique)
if (-not $paymentMethods -or $paymentMethods.Count -eq 0) {
  $paymentMethods = @("COD","MoMo","ZaloPay","VNPay")
}

$orderStatuses = @($data.orders.order_status | Where-Object { $_ } | Select-Object -Unique)
if (-not $orderStatuses -or $orderStatuses.Count -eq 0) {
  $orderStatuses = @("Processing","Shipping","Delivered")
}

$startOrder = [datetime]"2026-03-01T00:00:00Z"
$endOrder = [datetime]"2026-04-04T23:59:59Z"

# Group into orders of 1-3 items
$idx = 0
while ($idx -lt $saleLines.Count) {
  $size = Get-Random -Minimum 1 -Maximum 4
  $items = @($saleLines | Select-Object -Skip $idx -First $size)
  $idx += $items.Count

  $userId = Get-RandomFrom @($data.users.id)
  $promoId = Get-RandomFrom @($data.promotions.id)
  $promo = $promosById[$promoId]
  $discount = [int]$promo.discount_percent

  $subtotal = (@($items) | Measure-Object -Property unit_price -Sum).Sum
  $total = Round-ToInt ($subtotal * (100 - $discount) / 100)

  $order = [pscustomobject]@{
    id              = "$nextOrderId"
    user_id         = "$userId"
    promotion_id    = "$promoId"
    order_date      = (New-IsoDate (New-RandDate $startOrder $endOrder))
    total_amount    = $total
    shipping_address= (Get-RandomFrom $addresses)
    payment_method  = (Get-RandomFrom $paymentMethods)
    order_status    = (Get-RandomFrom $orderStatuses)
    items           = @(
      foreach ($it in $items) {
        [pscustomobject]@{
          book_item_id = "$($it.book_item_id)"
          title        = $it.title
          unit_price   = $it.unit_price
        }
      }
    )
  }

  $data.orders += $order
  $nextOrderId++
}

# Create rentals
$rentalStatuses = @($data.rentals.status | Where-Object { $_ } | Select-Object -Unique)
if (-not $rentalStatuses -or $rentalStatuses.Count -eq 0) {
  $rentalStatuses = @("Returned","Renting")
}

$paymentStatuses = @($data.rentals.payment_status | Where-Object { $_ } | Select-Object -Unique)
if (-not $paymentStatuses -or $paymentStatuses.Count -eq 0) {
  $paymentStatuses = @("Deposit collected")
}
$startRent = [datetime]"2026-02-01T00:00:00Z"
$endRent = [datetime]"2026-04-04T23:59:59Z"

foreach ($b in $data.books) {
  $need = $rentTargets[$b.id] - $currentRent[$b.id]
  if ($need -le 0) { continue }

  $rentItemId = Get-RentItemId $b.id
  if (-not $rentItemId) { throw "Missing rental book_item for book_id=$($b.id)" }
  $rentItem = $bookItemsById[$rentItemId]

  for ($i=0; $i -lt $need; $i++) {
    $userId = Get-RandomFrom @($data.users.id)
    $rentDate = New-RandDate $startRent $endRent
    $dueDate = $rentDate.AddDays(14)

    # keep at most one active rental per book: infer returned/active from existing status frequency
    $returnedStatus = ($data.rentals | Group-Object status | Sort-Object Count -Descending | Select-Object -First 1).Name
    if (-not $returnedStatus) { $returnedStatus = $rentalStatuses[0] }
    $activeStatus = ($rentalStatuses | Where-Object { $_ -ne $returnedStatus } | Select-Object -First 1)
    if (-not $activeStatus) { $activeStatus = $returnedStatus }

    $status = $returnedStatus
    if ($i -eq ($need - 1) -and (Get-Random -Minimum 1 -Maximum 101) -le 20) {
      $status = $activeStatus
    }

    $rental = [pscustomobject]@{
      id             = "$nextRentalId"
      user_id        = "$userId"
      book_item_id   = "$rentItemId"
      book_title     = "$($b.title) ($($rentItem.condition_type))"
      rent_date      = (New-IsoDate $rentDate)
      due_date       = (New-IsoDate $dueDate)
      actual_deposit = $rentItem.deposit_amount
      rental_fee     = $rentItem.current_rental_price
      payment_status = (Get-RandomFrom $paymentStatuses)
      status         = $status
    }

    $data.rentals += $rental
    $nextRentalId++

    # Do not mutate book_item.status (keeps existing conventions intact)
  }
}

# Create reviews (1-3 per new book; 0-2 for old)
$reviewTemplates = @(
  "Easy to read and well structured.",
  "Very useful, worth the price.",
  "Good content and clear explanations.",
  "Helpful and practical.",
  "Nice print quality and fast delivery."
)

$startReview = [datetime]"2026-03-01T00:00:00Z"
$endReview = [datetime]"2026-04-04T23:59:59Z"

foreach ($b in $data.books) {
  $idInt = [int]$b.id
  $reviewCount = 0
  if ($idInt -ge 11) {
    $reviewCount = Get-Random -Minimum 1 -Maximum 4
  } else {
    $reviewCount = Get-Random -Minimum 0 -Maximum 3
  }

  for ($i=0; $i -lt $reviewCount; $i++) {
    $userId = Get-RandomFrom @($data.users.id)
    $userName = $usersById[$userId].full_name
    $rating = Get-Random -Minimum 3 -Maximum 6

    $review = [pscustomobject]@{
      id          = "$nextReviewId"
      book_id     = "$($b.id)"
      user_id     = "$userId"
      user_name   = $userName
      rating      = $rating
      comment     = (Get-RandomFrom $reviewTemplates)
      is_approved = 1
      created_at  = (New-IsoDate (New-RandDate $startReview $endReview))
    }

    $data.reviews += $review
    $nextReviewId++
  }
}

# Recompute sold_count & rental_count from orders/rentals for perfect consistency
$soldCount = @{}
$rentalCount = @{}
foreach ($b in $data.books) { $soldCount[$b.id] = 0; $rentalCount[$b.id] = 0 }

foreach ($o in $data.orders) {
  foreach ($it in $o.items) {
    $bi = $bookItemsById[$it.book_item_id]
    if ($null -ne $bi) {
      $bid = $bi.book_id
      if ($soldCount.ContainsKey($bid)) { $soldCount[$bid]++ }
    }
  }
}

foreach ($r in $data.rentals) {
  $bi = $bookItemsById[$r.book_item_id]
  if ($null -ne $bi) {
    $bid = $bi.book_id
    if ($rentalCount.ContainsKey($bid)) { $rentalCount[$bid]++ }
  }
}

foreach ($b in $data.books) {
  $b.sold_count = $soldCount[$b.id]
  $b.rental_count = $rentalCount[$b.id]
}

# Save
$outJson = $data | ConvertTo-Json -Depth 50
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resolvedDbPath, $outJson, $utf8NoBom)

Write-Host "Done. orders=$($data.orders.Count) rentals=$($data.rentals.Count) reviews=$($data.reviews.Count)"
